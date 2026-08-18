import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { DiscardFilePlaceholderCommand } from "../../drive-items/application/commands/files/discard-file-placeholder.command";
import { QuotaService } from "../../quota/quota.service";
import { S3StorageAdapter } from "../../s3/s3-storage.adapter";
import { UploadPart } from "../schemas/upload-part.schema";
import {
  UploadMethod,
  UploadSession,
  UploadStatus,
} from "../schemas/upload-session.schema";

const EXPIRY_CLEANUP_PENDING = "EXPIRY_CLEANUP_PENDING";

@Injectable()
export class ReapExpiredUploadsUseCase {
  private readonly logger = new Logger(ReapExpiredUploadsUseCase.name);

  constructor(
    @InjectModel(UploadSession.name)
    private readonly sessions: Model<UploadSession>,
    @InjectModel(UploadPart.name)
    private readonly parts: Model<UploadPart>,
    private readonly storage: S3StorageAdapter,
    private readonly quota: QuotaService,
    private readonly discardPlaceholder: DiscardFilePlaceholderCommand,
  ) {}

  async execute(batchSize = 100): Promise<number> {
    const now = new Date();
    const expirableStatuses = [
      UploadStatus.PENDING,
      UploadStatus.PAUSED,
      UploadStatus.UPLOADED,
    ];
    const candidates = await this.sessions
      .find({
        $or: [
          {
            status: { $in: expirableStatuses },
            expiresAt: { $lt: now },
          },
          {
            status: UploadStatus.EXPIRED,
            errorCode: EXPIRY_CLEANUP_PENDING,
          },
        ],
      })
      .limit(batchSize)
      .lean();

    let reaped = 0;
    for (const candidate of candidates) {
      const claimed =
        candidate.status === UploadStatus.EXPIRED
          ? candidate
          : await this.sessions.findOneAndUpdate(
              {
                _id: candidate._id,
                status: candidate.status,
                expiresAt: { $lt: now },
              },
              {
                $set: {
                  status: UploadStatus.EXPIRED,
                  errorCode: EXPIRY_CLEANUP_PENDING,
                },
              },
              { returnDocument: "after" },
            );
      if (!claimed) continue;

      try {
        if (
          claimed.method === UploadMethod.MULTIPART &&
          claimed.providerUploadId
        ) {
          await this.storage.abortMultipartUpload(
            claimed.temporaryObjectKey,
            claimed.providerUploadId,
          );
        } else {
          await this.storage.deleteObject(claimed.temporaryObjectKey);
        }
        await this.quota.release(
          claimed.ownerId,
          BigInt(claimed.declaredSizeBytes as unknown as string),
          `${claimed.idempotencyKey ?? claimed._id.toString()}:expiry-release`,
        );
        await this.discardPlaceholder.execute(claimed.driveItemId);
        await this.parts.deleteMany({ uploadSessionId: claimed._id });
        await this.sessions.updateOne(
          {
            _id: claimed._id,
            status: UploadStatus.EXPIRED,
            errorCode: EXPIRY_CLEANUP_PENDING,
          },
          { $set: { errorCode: null } },
        );
        reaped++;
      } catch (error) {
        // Keep the cleanup marker so the next worker tick can safely retry.
        this.logger.error(
          `Failed to reap upload ${claimed._id}; cleanup will retry`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
    return reaped;
  }
}
