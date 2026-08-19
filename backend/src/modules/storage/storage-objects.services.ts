import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { StorageObjectDoc } from "./schemas/storage-object.schema";
import { StorageScanStatus, StorageObjectState, StorageProvider } from "./enums/storage-object.enum";
import { S3StorageAdapter } from "../s3/s3-storage.adapter";
import { Readable } from "node:stream";

/**
 * Quản lý vòng đời của object vật lý (metadata ở Mongo, byte ở MinIO).
 * - Collection này KHÔNG BAO GIỜ serialize trực tiếp ra client.
 * - bucket/objectKey là bí mật nội bộ; ra ngoài chỉ có presigned URL ngắn hạn.
 * - Xóa vật lý theo state machine idempotent: active -> deleting -> (xóa) | delete_failed.
 * - Một storage object ↔ một file (baseline không dedup, không refCount).
 */
@Injectable()
export class StorageObjectsService {
  private readonly logger = new Logger(StorageObjectsService.name);
  private readonly downloadUrlTtlSeconds = 3600;

  constructor(
    @InjectModel(StorageObjectDoc.name)
    private readonly model: Model<StorageObjectDoc>,
    private readonly storage: S3StorageAdapter
  ) {}

  //
  // CREATE — call by upload service when finalize. Byte had in MinIO.
  //
  async create(args: {
    ownerId: Types.ObjectId;
    bucket?: string;
    objectKey: string;
    sizeBytes: bigint;
    mimeType: string;
    checksumSha256: Buffer | null;
    provider?: StorageProvider;
    scanStatus?: StorageScanStatus;
  }): Promise<{ id: Types.ObjectId }> {
    const doc = await this.model.create({
      ownerId: args.ownerId,
      provider: args.provider ?? StorageProvider.MINIO,
      bucket: args.bucket ?? this.storage.getBucketName(),
      objectKey: args.objectKey,
      sizeBytes: args.sizeBytes,
      mimeType: args.mimeType,
      checksumSha256: args.checksumSha256,
      scanStatus: args.scanStatus ?? StorageScanStatus.NOT_REQUESTED,
      state: StorageObjectState.ACTIVE,
    });
    return { id: doc._id };
  }

  // READ helpers

  async findById(storageObjectId: Types.ObjectId): Promise<StorageObjectDoc | null> {
    return this.model.findById(storageObjectId);
  }

  //Get object have authorization + in active.

  private async getActiveOwnedOrThrow(
    storageObjectId: Types.ObjectId,
    ownerId: Types.ObjectId
  ): Promise<StorageObjectDoc> {
    const obj = await this.model.findOne({
      _id: storageObjectId,
      ownerId,
    });
    if (!obj) {
      throw new NotFoundException("STORAGE_OBJECT_NOT_FOUND");
    }
    if (obj.state !== StorageObjectState.ACTIVE) {
      throw new NotFoundException("STORAGE_OBJECT_UNAVAILABLE");
    }
    return obj;
  }

  // check permission scan (if turn on). scanStatus=clean => preview/download.

  private assertScanAllows(obj: StorageObjectDoc): void {
    if (
      obj.scanStatus === StorageScanStatus.INFECTED ||
      obj.scanStatus === StorageScanStatus.PENDING ||
      obj.scanStatus === StorageScanStatus.FAILED
    ) {
      throw new NotFoundException("STORAGE_OBJECT_UNAVAILABLE");
    }
  }

  // PRESIGNED URL — preview (inline) & download (attachment)

  async getPresignedPreviewUrl(
    storageObjectId: Types.ObjectId,
    ownerId: Types.ObjectId,
    responseContentType?: string,
  ): Promise<{ url: string; expiresInSeconds: number }> {
    const obj = await this.getActiveOwnedOrThrow(storageObjectId, ownerId);
    this.assertScanAllows(obj);

    const url = await this.storage.getPresignedGetUrl(obj.objectKey, {
      expiresIn: this.downloadUrlTtlSeconds,
      responseContentType: responseContentType ?? obj.mimeType,
      responseContentDisposition: "inline",
    });
    return { url, expiresInSeconds: this.downloadUrlTtlSeconds };
  }

  async getPresignedDownloadUrl(
    storageObjectId: Types.ObjectId,
    ownerId: Types.ObjectId,
    downloadFileName?: string
  ): Promise<{ url: string; expiresInSeconds: number }> {
    const obj = await this.getActiveOwnedOrThrow(storageObjectId, ownerId);
    this.assertScanAllows(obj);

    const disposition = downloadFileName
      ? `attachment; filename="${this.sanitizeFileName(downloadFileName)}"`
      : "attachment";

    const url = await this.storage.getPresignedGetUrl(obj.objectKey, {
      expiresIn: this.downloadUrlTtlSeconds,
      responseContentType: obj.mimeType,
      responseContentDisposition: disposition,
    });
    return { url, expiresInSeconds: this.downloadUrlTtlSeconds };
  }

  async getDownloadStream(
    storageObjectId: Types.ObjectId,
    ownerId: Types.ObjectId,
  ): Promise<{
    stream: Readable;
    contentLength: string;
    contentType: string;
  }> {
    const obj = await this.getActiveOwnedOrThrow(storageObjectId, ownerId);
    this.assertScanAllows(obj);
    const downloaded = await this.storage.getObject(obj.objectKey);
    return {
      stream: downloaded.stream,
      contentLength: String(downloaded.contentLength ?? obj.sizeBytes),
      contentType: downloaded.contentType ?? obj.mimeType,
    };
  }

  private sanitizeFileName(name: string): string {
    return name.replace(/["\\\r\n]/g, "_").slice(0, 255);
  }

  async readObjectHead(storageObjectId: Types.ObjectId, bytes = 4100): Promise<Buffer> {
    const obj = await this.model.findById(storageObjectId);
    if (!obj) throw new NotFoundException("STORAGE_OBJECT_NOT_FOUND");
    return this.storage.getObjectRange(obj.objectKey, 0, bytes - 1);
  }

  // PERMANENT DELETE — idempotent, state machine.
  // active -> deleting -> (xóa MinIO) -> xóa doc
  //                    -> lỗi -> delete_failed (worker retry sau)

  async permanentDelete(storageObjectId: Types.ObjectId): Promise<void> {
    // Atomic chuyển sang 'deleting'. Nếu doc không còn -> đã xóa rồi (idempotent).
    const obj = await this.model.findOneAndUpdate(
      {
        _id: storageObjectId,
        state: {
          $in: [
            StorageObjectState.ACTIVE,
            StorageObjectState.DELETE_FAILED, // cho phép retry
          ],
        },
      },
      { $set: { state: StorageObjectState.DELETING } },
      { returnDocument: "after" }
    );

    if (!obj) {
      // A missing document means an earlier delete already completed. A
      // document still in DELETING belongs to another worker, so callers must
      // not release quota or delete drive metadata yet.
      if (await this.model.exists({ _id: storageObjectId })) {
        throw new ConflictException("STORAGE_OBJECT_DELETE_IN_PROGRESS");
      }
      return;
    }

    try {
      // deleteObject của MinIO idempotent: xóa key không tồn tại vẫn thành công.
      await this.storage.deleteObject(obj.objectKey);
      await this.model.deleteOne({ _id: obj._id });
    } catch (err) {
      await this.model.updateOne({ _id: obj._id }, { $set: { state: StorageObjectState.DELETE_FAILED } });
      this.logger.error(`Permanent delete failed for object ${obj._id} (key=${obj.objectKey}): ${err}`);
      throw err;
    }
  }

  async permanentDeleteMany(
    storageObjectIds: Types.ObjectId[]
  ): Promise<{ deleted: number; failed: Types.ObjectId[] }> {
    let deleted = 0;
    const failed: Types.ObjectId[] = [];
    for (const id of storageObjectIds) {
      try {
        await this.permanentDelete(id);
        deleted++;
      } catch {
        failed.push(id);
      }
    }
    return { deleted, failed };
  }

  // =====================================================================
  // WORKER — retry các object 'delete_failed' hoặc 'deleting' bị treo.
  // Chạy định kỳ (cron). Idempotent theo thiết kế.
  // =====================================================================
  async retryFailedDeletions(
    batchSize = 100,
    stuckDeletingOlderThanMs = 10 * 60 * 1000 // 'deleting' treo > 10 phút coi là kẹt
  ): Promise<number> {
    const stuckThreshold = new Date(Date.now() - stuckDeletingOlderThanMs);

    const candidates = await this.model
      .find({
        $or: [
          { state: StorageObjectState.DELETE_FAILED },
          {
            state: StorageObjectState.DELETING,
            updatedAt: { $lt: stuckThreshold },
          },
        ],
      })
      .limit(batchSize)
      .lean();

    let cleaned = 0;
    for (const obj of candidates) {
      try {
        await this.storage.deleteObject(obj.objectKey);
        await this.model.deleteOne({ _id: obj._id });
        cleaned++;
      } catch (err) {
        await this.model.updateOne({ _id: obj._id }, { $set: { state: StorageObjectState.DELETE_FAILED } });
        this.logger.warn(`Retry delete still failing for object ${obj._id}: ${err}`);
      }
    }
    if (cleaned > 0) {
      this.logger.log(`Retry cleaned ${cleaned} storage objects`);
    }
    return cleaned;
  }

  // RECONCILIATION helper — tổng sizeBytes các object còn active của 1 user.
  // Dùng để đối chiếu với quota_accounts.usedBytes (phát hiện drift).

  async sumActiveBytesForOwner(ownerId: Types.ObjectId): Promise<bigint> {
    const result = await this.model.aggregate<{ total: number | bigint }>([
      {
        $match: {
          ownerId,
          state: StorageObjectState.ACTIVE,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$sizeBytes" },
        },
      },
    ]);

    if (result.length === 0) return 0n;
    return BigInt(result[0].total as any);
  }

  async updateScanStatus(storageObjectId: Types.ObjectId, scanStatus: StorageScanStatus): Promise<void> {
    await this.model.updateOne({ _id: storageObjectId }, { $set: { scanStatus } });
  }
}
