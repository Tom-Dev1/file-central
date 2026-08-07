import { BadRequestException, ConflictException, Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { CreateFilePlaceholderCommand } from "../../drive-items/application/commands/files/create-file-placeholder.command";
import { DiscardFilePlaceholderCommand } from "../../drive-items/application/commands/files/discard-file-placeholder.command";
import { QuotaService } from "../../quota/quota.service";
import { S3StorageAdapter } from "../../s3/s3-storage.adapter";
import {
  InitUploadDto,
  MAX_PARTS_ALLOWED,
  MIN_PART_SIZE_BYTES,
  SINGLE_PART_MAX_BYTES,
} from "../dto/upload.dto";
import { UploadPart } from "../schemas/upload-part.schema";
import {
  UploadMethod,
  UploadSession,
  UploadSessionDocument,
  UploadStatus,
} from "../schemas/upload-session.schema";

@Injectable()
export class InitUploadUseCase {
  private readonly logger = new Logger(InitUploadUseCase.name);
  private readonly sessionTtlMs = 24 * 60 * 60 * 1000;

  constructor(
    @InjectModel(UploadSession.name)
    private readonly sessions: Model<UploadSession>,
    @InjectModel(UploadPart.name)
    private readonly parts: Model<UploadPart>,
    private readonly storage: S3StorageAdapter,
    private readonly createPlaceholder: CreateFilePlaceholderCommand,
    private readonly discardPlaceholder: DiscardFilePlaceholderCommand,
    private readonly quota: QuotaService,
  ) {}

  async execute(ownerId: Types.ObjectId, dto: InitUploadDto) {
    const declaredSizeBytes = BigInt(dto.declaredSizeBytes);
    if (declaredSizeBytes <= 0n) {
      throw new BadRequestException("declaredSizeBytes must be positive");
    }

    const existing = await this.sessions.findOne({
      ownerId,
      idempotencyKey: dto.idempotencyKey,
    });
    if (existing) return this.buildResponse(existing);

    const reserved = await this.quota.reserve(
      ownerId,
      declaredSizeBytes,
      `${dto.idempotencyKey}:reserve`,
    );
    if (!reserved) {
      const concurrent = await this.sessions.findOne({
        ownerId,
        idempotencyKey: dto.idempotencyKey,
      });
      if (concurrent) return this.buildResponse(concurrent);
      throw new ConflictException("UPLOAD_INIT_IN_PROGRESS");
    }

    const sessionId = new Types.ObjectId();
    const objectKey = this.storage.buildObjectKey(
      ownerId.toHexString(),
      sessionId.toHexString(),
    );
    let driveItemId: Types.ObjectId | null = null;
    let providerUploadId: string | null = null;

    try {
      const placeholder = await this.createPlaceholder.execute({
        ownerId,
        parentId: dto.parentId ? new Types.ObjectId(dto.parentId) : null,
        name: dto.name,
      });
      driveItemId = placeholder.id;

      const multipart = declaredSizeBytes > BigInt(SINGLE_PART_MAX_BYTES);
      const partSizeBytes = multipart ? this.computePartSize(declaredSizeBytes) : null;
      const expectedPartsCount = partSizeBytes
        ? Number((declaredSizeBytes + BigInt(partSizeBytes) - 1n) / BigInt(partSizeBytes))
        : null;
      if (multipart) {
        providerUploadId = await this.storage.createMultipartUpload(
          objectKey,
          dto.mimeTypeHint,
        );
      }

      if (expectedPartsCount) {
        await this.parts.insertMany(
          Array.from({ length: expectedPartsCount }, (_, index) => ({
            uploadSessionId: sessionId,
            partNumber: index + 1,
            etag: null,
            sizeBytes: null,
          })),
          { ordered: false },
        );
      }

      // Publish the session only after all part placeholders exist. A retry
      // can never observe a multipart session with an incomplete manifest.
      const session = await this.sessions.create({
        _id: sessionId,
        ownerId,
        driveItemId,
        parentId: dto.parentId ? new Types.ObjectId(dto.parentId) : null,
        originalName: dto.name,
        method: multipart ? UploadMethod.MULTIPART : UploadMethod.SINGLE,
        providerUploadId,
        temporaryObjectKey: objectKey,
        partSizeBytes,
        expectedPartsCount,
        declaredSizeBytes,
        declaredChecksumSha256: dto.declaredChecksumSha256Hex
          ? Buffer.from(dto.declaredChecksumSha256Hex, "hex")
          : null,
        status: UploadStatus.PENDING,
        idempotencyKey: dto.idempotencyKey,
        expiresAt: new Date(Date.now() + this.sessionTtlMs),
      });
      this.logger.log(`Initialized upload session ${sessionId} for ${ownerId}`);
      return this.buildResponse(session);
    } catch (error) {
      await this.rollback({
        ownerId,
        declaredSizeBytes,
        idempotencyKey: dto.idempotencyKey,
        driveItemId,
        objectKey,
        providerUploadId,
        sessionId,
      });
      throw error;
    }
  }

  private computePartSize(totalBytes: bigint): number {
    const computed = Number(
      (totalBytes + BigInt(MAX_PARTS_ALLOWED) - 1n) /
        BigInt(MAX_PARTS_ALLOWED),
    );
    return Math.max(MIN_PART_SIZE_BYTES, computed);
  }

  private async buildResponse(session: UploadSessionDocument) {
    if (session.status === UploadStatus.COMPLETED) {
      return {
        uploadSessionId: session._id.toString(),
        method: session.method,
        status: session.status,
        driveItemId: session.driveItemId,
        expiresAt: session.expiresAt,
      };
    }
    if (session.status === UploadStatus.PROCESSING) {
      return {
        uploadSessionId: session._id.toString(),
        method: session.method,
        status: session.status,
        expiresAt: session.expiresAt,
      };
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      throw new ConflictException("UPLOAD_SESSION_EXPIRED");
    }
    if (
      [UploadStatus.ABORTED, UploadStatus.EXPIRED, UploadStatus.FAILED].includes(
        session.status,
      )
    ) {
      throw new ConflictException(
        `UPLOAD_SESSION_NOT_RESUMABLE:${session.status}`,
      );
    }
    if (session.method === UploadMethod.SINGLE) {
      return {
        uploadSessionId: session._id.toString(),
        method: session.method,
        putUrl: await this.storage.getPresignedPutUrl(session.temporaryObjectKey),
        expiresAt: session.expiresAt,
      };
    }
    const missingParts = await this.parts
      .find({ uploadSessionId: session._id, etag: null })
      .sort({ partNumber: 1 })
      .lean();
    const partUrls = await Promise.all(
      missingParts.map(async (part) => ({
        partNumber: part.partNumber,
        url: await this.storage.getPresignedPartUrl(
          session.temporaryObjectKey,
          session.providerUploadId!,
          part.partNumber,
        ),
      })),
    );
    return {
      uploadSessionId: session._id.toString(),
      method: session.method,
      partSizeBytes: session.partSizeBytes,
      expectedPartsCount: session.expectedPartsCount,
      partUrls,
      expiresAt: session.expiresAt,
    };
  }

  private async rollback(args: {
    ownerId: Types.ObjectId;
    declaredSizeBytes: bigint;
    idempotencyKey: string;
    driveItemId: Types.ObjectId | null;
    objectKey: string;
    providerUploadId: string | null;
    sessionId: Types.ObjectId;
  }): Promise<void> {
    await this.parts.deleteMany({ uploadSessionId: args.sessionId }).catch(() => undefined);
    await this.sessions.deleteOne({ _id: args.sessionId }).catch(() => undefined);
    if (args.providerUploadId) {
      await this.storage
        .abortMultipartUpload(args.objectKey, args.providerUploadId)
        .catch(() => undefined);
    }
    await this.storage.deleteObject(args.objectKey).catch(() => undefined);
    if (args.driveItemId) {
      await this.discardPlaceholder.execute(args.driveItemId).catch(() => undefined);
    }
    await this.quota
      .rollbackReservation(
        args.ownerId,
        args.declaredSizeBytes,
        `${args.idempotencyKey}:reserve`,
        `${args.idempotencyKey}:init-rollback`,
      )
      .catch((error: unknown) => {
        this.logger.error(
          `Failed to release quota while rolling back upload ${args.sessionId}`,
          error instanceof Error ? error.stack : String(error),
        );
      });
  }
}
