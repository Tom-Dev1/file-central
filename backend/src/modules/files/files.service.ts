import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Types } from "mongoose";
import { createReadStream } from "fs";
import { unlink } from "fs/promises";
import { extname } from "path";
import { Readable } from "stream";
import { randomUUID } from "crypto";
import { DriveItemsService } from "../drive-items/drive-items.service";
import { DriveItemType } from "../drive-items/schemas/drive-item.schema";
import { MinioService } from "../storage/minio.service";
import { PermissionsService } from "../permissions/permissions.service";
import { SharePermission } from "../shares/schemas/share.schema";
import { FileStatus } from "../drive-items/enums/drive-item.enum";

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private driveItemsService: DriveItemsService,
    private minioService: MinioService,
    private permissionsService: PermissionsService
  ) {}

  /**
   * Upload flow:
   *   1. Validate parent folder + duplicate name up front (fail fast, no I/O to MinIO yet)
   *   2. Re-stream the multer temp file (already on disk, NOT in RAM) to MinIO
   *   3. Save metadata to MongoDB
   *   4. If step 3 fails, delete the just-uploaded object from MinIO so we
   *      never end up with an orphaned object with no matching metadata.
   *   5. ALWAYS delete the multer temp file afterwards, success or failure.
   */
  async upload(ownerId: string, parentId: string | null | undefined, file: Express.Multer.File) {
    let uploadedObjectKey: string | null = null;
    try {
      const resolvedParentId = await this.driveItemsService.assertValidParent(ownerId, parentId);
      await this.driveItemsService.assertNoDuplicateName(ownerId, resolvedParentId, file.originalname);

      const extension = extname(file.originalname).slice(1).toLowerCase() || null;
      // Keep the storage key independent from user-controlled names. Rename and
      // move operations should only ever update MongoDB metadata.
      const objectKey = `users/${ownerId}/files/${randomUUID()}`;
      const parent = resolvedParentId
        ? await this.driveItemsService.model.findById(resolvedParentId).select("ancestorIds").lean()
        : null;
      const ancestorIds = resolvedParentId ? [...(parent?.ancestorIds ?? []), resolvedParentId] : [];

      // file.path is set because FilesController configures multer with
      // diskStorage - the bytes are already on disk, never buffered fully
      // in the Node process's memory.
      const readStream = createReadStream(file.path);
      await this.minioService.putObject(objectKey, readStream, file.size, file.mimetype);
      uploadedObjectKey = objectKey;

      try {
        const created = await this.driveItemsService.model.create({
          name: file.originalname,
          normalizedName: this.normalizeName(file.originalname),
          type: DriveItemType.FILE,
          ownerId: new Types.ObjectId(ownerId),
          parentId: resolvedParentId,
          ancestorIds,
          fileStatus: FileStatus.ACTIVE,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          bucket: this.minioService.getBucketName(),
          objectKey,
          extension,
          isDeleted: false,
        });
        uploadedObjectKey = null;
        return created;
      } catch (err) {
        this.logger.warn(`Mongo save failed after MinIO upload, rolling back object ${objectKey}`);
        try {
          await this.minioService.removeObject(objectKey);
          uploadedObjectKey = null;
        } catch (cleanupErr) {
          // Leave uploadedObjectKey set so the outer finally block retries.
          this.logger.error(`Failed to clean up orphaned MinIO object ${objectKey}: ${(cleanupErr as Error).message}`);
        }
        throw err;
      }
    } finally {
      // Covers unexpected failures after the object was uploaded but before
      // metadata creation/rollback completed.
      if (uploadedObjectKey) {
        await this.minioService.removeObject(uploadedObjectKey).catch((cleanupErr) => {
          this.logger.error(
            `Failed to clean up orphaned MinIO object ${uploadedObjectKey}: ${(cleanupErr as Error).message}`
          );
        });
      }
      // Always clean up the multer temp file, whether upload succeeded or not.
      await unlink(file.path).catch((cleanupErr) => {
        this.logger.warn(`Failed to remove temp upload file ${file.path}: ${(cleanupErr as Error).message}`);
      });
    }
  }

  private normalizeName(name: string): string {
    return name.normalize("NFKC").trim().toLocaleLowerCase("en-US");
  }

  /**
   * Returns everything the controller needs to stream the file back:
   * the readable stream from MinIO plus the metadata (for headers).
   * Requires at least DOWNLOAD permission (owner, or shared directly/via
   * an ancestor folder with download/edit permission).
   */
  async getDownloadStream(
    userId: string,
    userEmail: string | undefined,
    fileId: string
  ): Promise<{ stream: Readable; name: string; mimeType?: string | null; size?: number | null }> {
    const objectId = new Types.ObjectId(fileId);
    await this.permissionsService.requireAccess(userId, userEmail, objectId, SharePermission.DOWNLOAD);

    const item = await this.driveItemsService.model.findById(objectId);
    if (!item || item.isDeleted || item.type !== DriveItemType.FILE || !item.objectKey) {
      throw new NotFoundException("File not found");
    }

    const stream = await this.minioService.getObjectStream(item.objectKey);
    return { stream, name: item.name, mimeType: item.mimeType, size: item.sizeBytes };
  }

  /**
   * Preview access only requires VIEW permission (weaker than download),
   * matching Google Drive's behavior of letting "viewer" role preview
   * without granting a download.
   */
  async getPreviewStream(
    userId: string,
    userEmail: string | undefined,
    fileId: string
  ): Promise<{ stream: Readable; mimeType?: string | null; name: string }> {
    const objectId = new Types.ObjectId(fileId);
    await this.permissionsService.requireAccess(userId, userEmail, objectId, SharePermission.VIEW);

    const item = await this.driveItemsService.model.findById(objectId);
    if (!item || item.isDeleted || item.type !== DriveItemType.FILE || !item.objectKey) {
      throw new NotFoundException("File not found");
    }

    const stream = await this.minioService.getObjectStream(item.objectKey);
    return { stream, mimeType: item.mimeType, name: item.name };
  }
}
