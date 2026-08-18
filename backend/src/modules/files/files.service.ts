import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { createHash, randomUUID } from "crypto";
import { createReadStream } from "fs";
import { open } from "fs/promises";
import { unlink } from "fs/promises";
import { Types } from "mongoose";
import { ActivateFileCommand } from "../drive-items/application/commands/files/activate-file.command";
import { CreateFilePlaceholderCommand } from "../drive-items/application/commands/files/create-file-placeholder.command";
import { DiscardFilePlaceholderCommand } from "../drive-items/application/commands/files/discard-file-placeholder.command";
import { RollbackFileActivationCommand } from "../drive-items/application/commands/files/rollback-file-activation.command";
import { DriveItemLookupQuery } from "../drive-items/application/queries/drive-item-lookup.query";
import { DriveItemParentService } from "../drive-items/application/services/drive-item-parent.service";
import { DriveItemType } from "../drive-items/domain/enums/drive-item.enum";
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
    private readonly items: DriveItemLookupQuery,
    private readonly parents: DriveItemParentService,
    private readonly createPlaceholder: CreateFilePlaceholderCommand,
    private readonly discardPlaceholder: DiscardFilePlaceholderCommand,
    private readonly activateFile: ActivateFileCommand,
    private readonly rollbackActivation: RollbackFileActivationCommand,
    private readonly minio: MinioService,
    private readonly storageObjects: StorageObjectsService,
    private readonly permissions: PermissionsService,
    private readonly quota: QuotaService,
    private readonly metadataResolver: FileMetadataResolverService
  ) {}

  async upload(ownerIdValue: string, parentIdValue: string | null | undefined, file: Express.Multer.File) {
    const ownerId = new Types.ObjectId(ownerIdValue);
    const parentId = await this.parents.validate(ownerIdValue, parentIdValue);
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
      const placeholder = await this.createPlaceholder.execute({ ownerId, parentId, name: metadata.name });
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
      await this.activateFile.execute({
        driveItemId,
        storageObjectId,
        mimeType: metadata.mimeType,
        sizeBytes: bytes,
        extension: metadata.detectedExtension ?? metadata.extension,
      });
      const activatedItem = await this.items.findById(driveItemId);
      if (!activatedItem) throw new NotFoundException("DRIVE_ITEM_NOT_FOUND");
      await this.quota.commit(ownerId, bytes, `legacy-upload:${operationId}:commit`, { driveItemId });
      reserved = false;
      return activatedItem;
    } catch (error) {
      if (storageObjectId)
        await this.storageObjects
          .permanentDelete(storageObjectId)
          .catch((cleanup) => this.logger.error(String(cleanup)));
      else await this.minio.removeObject(objectKey).catch(() => undefined);
      if (driveItemId) {
        await this.rollbackActivation.execute(driveItemId);
        await this.discardPlaceholder.execute(driveItemId);
      }
      if (reserved)
        await this.quota.release(ownerId, bytes, `legacy-upload:${operationId}:rollback`).catch(() => undefined);
      throw error;
    } finally {
      await unlink(file.path).catch(() => undefined);
    }
  }

  async getDownloadStream(userId: string, userEmail: string | undefined, fileId: string) {
    const item = await this.resolveActiveFile(
      userId,
      userEmail,
      fileId,
      SharePermission.DOWNLOAD,
    );
    const download = await this.storageObjects.getDownloadStream(
      item.storageObjectId!,
      item.ownerId,
    );
    return { ...download, fileName: item.name };
  }

  async getPreviewUrl(userId: string, userEmail: string | undefined, fileId: string) {
    const item = await this.resolveActiveFile(
      userId,
      userEmail,
      fileId,
      SharePermission.VIEW,
    );
    return this.storageObjects.getPresignedPreviewUrl(
      item.storageObjectId!,
      item.ownerId,
    );
  }

  private async resolveActiveFile(
    userId: string,
    userEmail: string | undefined,
    fileId: string,
    permission: SharePermission,
  ) {
    const itemId = new Types.ObjectId(fileId);
    await this.permissions.requireAccess(userId, userEmail, itemId, permission);
    const item = await this.items.findOne({ _id: itemId, type: DriveItemType.FILE, isTrashed: false });
    if (!item?.storageObjectId) throw new NotFoundException("FILE_NOT_ACTIVE");
    return item;
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
