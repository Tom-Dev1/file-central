import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { DiscardFilePlaceholderCommand } from "../../drive-items/application/commands/files/discard-file-placeholder.command";
import { QuotaService } from "../../quota/quota.service";
import { S3StorageAdapter } from "../../s3/s3-storage.adapter";
import { UploadPart } from "../schemas/upload-part.schema";
import {
  UploadMethod,
  UploadSession,
  UploadSessionDocument,
  UploadStatus,
} from "../schemas/upload-session.schema";

const ABORT_CLEANUP_PENDING = "ABORT_CLEANUP_PENDING";

@Injectable()
export class AbortUploadUseCase {
  private readonly logger = new Logger(AbortUploadUseCase.name);

  constructor(
    @InjectModel(UploadSession.name)
    private readonly sessions: Model<UploadSession>,
    @InjectModel(UploadPart.name)
    private readonly parts: Model<UploadPart>,
    private readonly storage: S3StorageAdapter,
    private readonly quota: QuotaService,
    private readonly discardPlaceholder: DiscardFilePlaceholderCommand,
  ) {}

  async execute(ownerId: Types.ObjectId, sessionId: Types.ObjectId) {
    const abortableStatuses = [
      UploadStatus.PENDING,
      UploadStatus.PAUSED,
      UploadStatus.UPLOADED,
    ];
    let session = await this.sessions.findOneAndUpdate(
      {
        _id: sessionId,
        ownerId,
        status: { $in: abortableStatuses },
      },
      {
        $set: {
          status: UploadStatus.ABORTED,
          errorCode: ABORT_CLEANUP_PENDING,
        },
      },
      { returnDocument: "after" },
    );

    if (!session) {
      session = await this.sessions.findOne({ _id: sessionId, ownerId });
      if (!session) throw new NotFoundException("UPLOAD_SESSION_NOT_FOUND");
      if (
        session.status === UploadStatus.ABORTED &&
        session.errorCode !== ABORT_CLEANUP_PENDING
      ) {
        return { status: session.status };
      }
      if (
        session.status !== UploadStatus.ABORTED ||
        session.errorCode !== ABORT_CLEANUP_PENDING
      ) {
        throw new ConflictException(`Cannot abort session in status ${session.status}`);
      }
    }

    await this.cleanup(session);
    return { status: UploadStatus.ABORTED };
  }

  private async cleanup(session: UploadSessionDocument): Promise<void> {
    try {
      if (session.method === UploadMethod.MULTIPART && session.providerUploadId) {
        await this.storage.abortMultipartUpload(
          session.temporaryObjectKey,
          session.providerUploadId,
        );
      } else {
        await this.storage.deleteObject(session.temporaryObjectKey);
      }
      await this.quota.release(
        session.ownerId,
        BigInt(session.declaredSizeBytes as unknown as string),
        `${session.idempotencyKey ?? session._id.toString()}:abort-release`,
      );
      await this.discardPlaceholder.execute(session.driveItemId);
      await this.parts.deleteMany({ uploadSessionId: session._id });
      await this.sessions.updateOne(
        {
          _id: session._id,
          status: UploadStatus.ABORTED,
          errorCode: ABORT_CLEANUP_PENDING,
        },
        { $set: { errorCode: null } },
      );
    } catch (error) {
      this.logger.error(
        `Failed to abort upload ${session._id}; cleanup can be retried`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
