import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { ActivateFileCommand } from "../../drive-items/application/commands/files/activate-file.command";
import { RollbackFileActivationCommand } from "../../drive-items/application/commands/files/rollback-file-activation.command";
import { QuotaService } from "../../quota/quota.service";
import { S3StorageAdapter } from "../../s3/s3-storage.adapter";
import {
  StorageProvider,
  StorageScanStatus,
} from "../../storage/enums/storage-object.enum";
import { MimeDetectorService } from "../../storage/mime-detector.service";
import { StorageObjectsService } from "../../storage/storage-objects.services";
import { CompleteUploadDto } from "../dto/upload.dto";
import {
  UploadMethod,
  UploadSession,
  UploadSessionDocument,
  UploadStatus,
} from "../schemas/upload-session.schema";

@Injectable()
export class CompleteUploadUseCase {
  private readonly logger = new Logger(CompleteUploadUseCase.name);

  constructor(
    @InjectModel(UploadSession.name)
    private readonly sessions: Model<UploadSession>,
    private readonly storage: S3StorageAdapter,
    private readonly storageObjects: StorageObjectsService,
    private readonly mimeDetector: MimeDetectorService,
    private readonly activateFile: ActivateFileCommand,
    private readonly rollbackActivation: RollbackFileActivationCommand,
    private readonly quota: QuotaService,
  ) {}

  async execute(
    ownerId: Types.ObjectId,
    sessionId: Types.ObjectId,
    dto: CompleteUploadDto,
  ) {
    const completableStatuses = [
      UploadStatus.PENDING,
      UploadStatus.UPLOADED,
      UploadStatus.PAUSED,
    ];
    const session = await this.sessions.findOneAndUpdate(
      {
        _id: sessionId,
        ownerId,
        status: { $in: completableStatuses },
        expiresAt: { $gt: new Date() },
      },
      { $set: { status: UploadStatus.PROCESSING, errorCode: null } },
      { returnDocument: "after" },
    );
    if (!session) {
      const current = await this.sessions.findOne({ _id: sessionId, ownerId });
      if (!current) throw new NotFoundException("UPLOAD_SESSION_NOT_FOUND");
      if (current.status === UploadStatus.COMPLETED) {
        return { driveItemId: current.driveItemId, status: current.status };
      }
      if (current.expiresAt.getTime() <= Date.now()) {
        throw new ConflictException("UPLOAD_SESSION_EXPIRED");
      }
      throw new ConflictException(
        `Cannot complete session in status ${current.status}`,
      );
    }
    let createdStorageObjectId: Types.ObjectId | null = null;
    let quotaCommitted = false;

    try {
      const finalSizeBytes = await this.finalizeObject(session, dto);
      const declaredSizeBytes = BigInt(
        session.declaredSizeBytes as unknown as string,
      );
      if (finalSizeBytes > declaredSizeBytes) {
        throw new BadRequestException(
          `Uploaded size exceeds declaration: declared ${declaredSizeBytes}, actual ${finalSizeBytes}`,
        );
      }
      const prefix = await this.storage.getObjectRange(
        session.temporaryObjectKey,
        0,
        4100,
      );
      const { mimeType, extension } = await this.mimeDetector.detect(
        prefix,
        session.originalName ?? "upload",
      );
      const storageObject = await this.storageObjects.create({
        ownerId,
        bucket: this.storage.getBucketName(),
        objectKey: session.temporaryObjectKey,
        sizeBytes: finalSizeBytes,
        mimeType,
        checksumSha256: session.declaredChecksumSha256,
        provider: StorageProvider.MINIO,
        scanStatus: StorageScanStatus.NOT_REQUESTED,
      });
      createdStorageObjectId = storageObject.id;
      await this.activateFile.execute({
        driveItemId: session.driveItemId,
        storageObjectId: storageObject.id,
        mimeType,
        sizeBytes: finalSizeBytes,
        extension,
      });
      await this.quota.commit(
        ownerId,
        finalSizeBytes,
        `${session.idempotencyKey ?? session._id.toString()}:commit`,
        { uploadSessionId: session._id, driveItemId: session.driveItemId },
      );
      quotaCommitted = true;
      const reservedExtra = declaredSizeBytes - finalSizeBytes;
      if (reservedExtra > 0n) {
        await this.quota.release(
          ownerId,
          reservedExtra,
          `${session.idempotencyKey ?? session._id.toString()}:adjust`,
        );
      }
      await this.sessions.updateOne(
        { _id: session._id, status: UploadStatus.PROCESSING },
        {
          $set: {
            status: UploadStatus.COMPLETED,
            actualSizeBytes: finalSizeBytes,
            errorCode: null,
          },
        },
      );
      return {
        driveItemId: session.driveItemId,
        status: UploadStatus.COMPLETED,
      };
    } catch (error) {
      if (quotaCommitted) {
        this.logger.error(
          `Upload ${session._id} committed but final bookkeeping failed`,
          error instanceof Error ? error.stack : String(error),
        );
        await this.sessions
          .updateOne(
            { _id: session._id },
            {
              $set: {
                status: UploadStatus.COMPLETED,
                errorCode: null,
              },
            },
          )
          .catch(() => undefined);
        return {
          driveItemId: session.driveItemId,
          status: UploadStatus.COMPLETED,
        };
      }
      await this.rollback(
        session,
        ownerId,
        createdStorageObjectId,
        quotaCommitted,
        error,
      );
      throw error;
    }
  }

  private async finalizeObject(
    session: UploadSessionDocument,
    dto: CompleteUploadDto,
  ): Promise<bigint> {
    if (session.method !== UploadMethod.MULTIPART) {
      const head = await this.storage.headObject(session.temporaryObjectKey);
      if (!head) throw new BadRequestException("Object not found on storage");
      return BigInt(head.sizeBytes);
    }

    const remoteParts = await this.storage.listParts(
      session.temporaryObjectKey,
      session.providerUploadId!,
    );
    const expected = session.expectedPartsCount ?? 0;
    if (remoteParts.length !== expected) {
      throw new BadRequestException(
        `Expected ${expected} parts, uploaded ${remoteParts.length}`,
      );
    }
    const partNumbers = remoteParts
      .map((part) => part.partNumber)
      .sort((left, right) => left - right);
    if (partNumbers.some((partNumber, index) => partNumber !== index + 1)) {
      throw new BadRequestException("Multipart upload has invalid part numbers");
    }
    if (dto.parts?.length) {
      const submitted = new Map(
        dto.parts.map((part) => [part.partNumber, part]),
      );
      const mismatch = remoteParts.some((remote) => {
        const part = submitted.get(remote.partNumber);
        return (
          !part ||
          this.normalizeEtag(part.etag) !== this.normalizeEtag(remote.etag) ||
          BigInt(part.sizeBytes) !== BigInt(remote.sizeBytes)
        );
      });
      if (submitted.size !== expected || mismatch) {
        throw new BadRequestException(
          "Submitted multipart manifest does not match storage",
        );
      }
    }
    await this.storage.completeMultipartUpload(
      session.temporaryObjectKey,
      session.providerUploadId!,
      remoteParts,
    );
    return remoteParts.reduce(
      (total, part) => total + BigInt(part.sizeBytes),
      0n,
    );
  }

  private async rollback(
    session: UploadSessionDocument,
    ownerId: Types.ObjectId,
    storageObjectId: Types.ObjectId | null,
    quotaCommitted: boolean,
    error: unknown,
  ): Promise<void> {
    if (quotaCommitted) {
      this.logger.error(
        `Upload ${session._id} committed but final session update failed`,
        error instanceof Error ? error.stack : String(error),
      );
      return;
    }
    session.status = UploadStatus.FAILED;
    session.errorCode = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    await session.save().catch(() => undefined);
    await this.rollbackActivation.execute(session.driveItemId).catch(() => undefined);
    if (storageObjectId) {
      await this.storageObjects.permanentDelete(storageObjectId).catch(() => undefined);
    } else {
      if (session.method === UploadMethod.MULTIPART && session.providerUploadId) {
        await this.storage
          .abortMultipartUpload(
            session.temporaryObjectKey,
            session.providerUploadId,
          )
          .catch(() => undefined);
      }
      await this.storage.deleteObject(session.temporaryObjectKey).catch(() => undefined);
    }
    await this.quota
      .release(
        ownerId,
        BigInt(session.declaredSizeBytes as unknown as string),
        `${session.idempotencyKey ?? session._id.toString()}:failure-release`,
      )
      .catch(() => undefined);
  }

  private normalizeEtag(etag: string): string {
    return etag.trim().replace(/"/g, "");
  }
}
