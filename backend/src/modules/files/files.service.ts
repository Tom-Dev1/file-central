import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { createHash, randomUUID } from "crypto";
import { createReadStream } from "fs";
import { open } from "fs/promises";
import { unlink } from "fs/promises";
import { Types } from "mongoose";
import { DriveItemsService } from "../drive-items/drive-items.service";
import { DriveItemType } from "../drive-items/enums/drive-item.enum";
import { PermissionsService } from "../permissions/permissions.service";
import { QuotaService } from "../quota/quota.service";
import { SharePermission } from "../shares/schemas/share.schema";
import { MinioService } from "../storage/minio.service";
import { FileMetadataResolverService } from "./file-metadata-resolver.service";
import { StorageObjectsService } from "../storage/storage-objects.services";

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly driveItems: DriveItemsService,
    private readonly minio: MinioService,
    private readonly storageObjects: StorageObjectsService,
    private readonly permissions: PermissionsService,
    private readonly quota: QuotaService,
    private readonly metadataResolver: FileMetadataResolverService
  ) {}

  async upload(ownerIdValue: string, parentIdValue: string | null | undefined, file: Express.Multer.File) {
    const ownerId = new Types.ObjectId(ownerIdValue);
    const parentId = await this.driveItems.assertValidParent(ownerIdValue, parentIdValue);
    const bytes = BigInt(file.size);
    const operationId = randomUUID();
    const objectKey = `objects/${ownerIdValue}/${operationId}`;
    let driveItemId: Types.ObjectId | null = null;
    let storageObjectId: Types.ObjectId | null = null;
    let reserved = false;

    try {
      const prefix = await this.readPrefix(file.path);
      const metadata = await this.metadataResolver.resolveFromBuffer(file.originalname, file.mimetype, prefix);
      await this.quota.reserve(ownerId, bytes, `legacy-upload:${operationId}:reserve`);
      reserved = true;
      const placeholder = await this.driveItems.createPlaceholder({ ownerId, parentId, name: metadata.name });
      driveItemId = placeholder.id;
      const checksum = await this.calculateSha256(file.path);
      await this.minio.putObject(objectKey, createReadStream(file.path), file.size, metadata.mimeType);
      const storageObject = await this.storageObjects.create({
        ownerId,
        objectKey,
        sizeBytes: bytes,
        mimeType: metadata.mimeType,
        checksumSha256: checksum,
      });
      storageObjectId = storageObject.id;
      await this.driveItems.activateFile({
        driveItemId,
        storageObjectId,
        mimeType: metadata.mimeType,
        sizeBytes: bytes,
        extension: metadata.detectedExtension ?? metadata.extension,
      });
      await this.quota.commit(ownerId, bytes, `legacy-upload:${operationId}:commit`, { driveItemId });
      reserved = false;
      return this.driveItems.model.findById(driveItemId);
    } catch (error) {
      if (storageObjectId)
        await this.storageObjects
          .permanentDelete(storageObjectId)
          .catch((cleanup) => this.logger.error(String(cleanup)));
      else await this.minio.removeObject(objectKey).catch(() => undefined);
      if (driveItemId) await this.driveItems.rollbackActivation(driveItemId);
      if (reserved)
        await this.quota.release(ownerId, bytes, `legacy-upload:${operationId}:rollback`).catch(() => undefined);
      throw error;
    } finally {
      await unlink(file.path).catch(() => undefined);
    }
  }

  async getDownloadUrl(userId: string, userEmail: string | undefined, fileId: string) {
    return this.getUrl(userId, userEmail, fileId, SharePermission.DOWNLOAD);
  }

  async getPreviewUrl(userId: string, userEmail: string | undefined, fileId: string) {
    return this.getUrl(userId, userEmail, fileId, SharePermission.VIEW);
  }

  private async getUrl(userId: string, userEmail: string | undefined, fileId: string, permission: SharePermission) {
    const itemId = new Types.ObjectId(fileId);
    await this.permissions.requireAccess(userId, userEmail, itemId, permission);
    const item = await this.driveItems.model.findOne({ _id: itemId, type: DriveItemType.FILE, isTrashed: false });
    if (!item?.storageObjectId) throw new NotFoundException("FILE_NOT_ACTIVE");
    const url = await this.storageObjects.getPresignedDownloadUrl(item.storageObjectId, item.ownerId);
    return { url, expiresInSeconds: 3600 };
  }

  private async calculateSha256(path: string): Promise<Buffer> {
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(path)) hash.update(chunk);
    return hash.digest();
  }

  private async readPrefix(path: string, maxBytes = 8192): Promise<Buffer> {
    const handle = await open(path, "r");
    try {
      const buffer = Buffer.alloc(maxBytes);
      const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0);
      return buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }
}
