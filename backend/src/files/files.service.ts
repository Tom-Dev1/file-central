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
import { classifyPreviewKind, PreviewKind } from "./previewkind";

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private driveItemsService: DriveItemsService,
    private minioService: MinioService,
    private permissionsService: PermissionsService // private fileMetadataResolverService: FileMetadataResolverService
  ) {}

  // Upload flow:
  // 1. Validate parent folder + duplicate name up front (fail fast, no I/O to MinIO yet)
  //  2. Re-stream the multer temp file (already on disk, NOT in RAM) to MinIO
  //  3. Save metadata to MongoDB
  //  4. If step 3 fails, delete the just-uploaded object from MinIO
  //    never end up with an orphaned object with no matching metadata.
  //  5. ALWAYS delete the multer temp file afterwards, success or failure.

  async upload(ownerId: string, parentId: string | null | undefined, file: Express.Multer.File) {
    const resolvedParentId = await this.driveItemsService.assertValidParent(ownerId, parentId);
    // auto-rename: "Whale.png" -> "Whale 1.png" w
    const uniqueName = await this.driveItemsService.resolveUniqueName(ownerId, resolvedParentId, file.originalname);

    const extension = extname(uniqueName).replace(".", "");
    const objectKey = `users/${ownerId}/files/${randomUUID()}-${uniqueName}`;

    try {
      // file.path is set because FilesController configures multer with
      // diskStorage - the bytes are already on disk, never buffered fully
      // in the Node process's memory.
      const readStream = createReadStream(file.path);
      await this.minioService.putObject(objectKey, readStream, file.size, file.mimetype);

      try {
        const created = await this.driveItemsService.model.create({
          name: uniqueName,
          type: DriveItemType.FILE,
          ownerId: new Types.ObjectId(ownerId),
          parentId: resolvedParentId,
          mimeType: file.mimetype,
          size: file.size,
          bucket: this.minioService.getBucketName(),
          objectKey,
          extension,
          isDeleted: false,
          lastModifiedAt: new Date(),
          lastViewedAt: new Date(),
        });
        return created;
      } catch (err) {
        this.logger.warn(`Mongo save failed after MinIO upload, rolling back object ${objectKey}`);
        await this.minioService.removeObject(objectKey).catch((cleanupErr) => {
          this.logger.error(`Failed to clean up orphaned MinIO object ${objectKey}: ${(cleanupErr as Error).message}`);
        });
        throw err;
      }
    } finally {
      await unlink(file.path).catch((cleanupErr) => {
        this.logger.warn(`Failed to remove temp upload file ${file.path}: ${(cleanupErr as Error).message}`);
      });
    }
  }

  async getDownloadStream(
    userId: string,
    userEmail: string | undefined,
    fileId: string
  ): Promise<{ stream: Readable; name: string; mimeType?: string; size?: number }> {
    const objectId = new Types.ObjectId(fileId);
    await this.permissionsService.requireAccess(userId, userEmail, objectId, SharePermission.DOWNLOAD);

    const item = await this.driveItemsService.model.findById(objectId);
    if (!item || item.isDeleted || item.type !== DriveItemType.FILE || !item.objectKey) {
      throw new NotFoundException("File not found");
    }

    // Fire-and-forget: a download counts as a view. Must not block the
    // stream or fail the request if this stamp write errors.
    this.driveItemsService.touchViewed(objectId).catch((err) => {
      this.logger.warn(`Failed to update lastViewedAt for ${objectId}: ${(err as Error).message}`);
    });

    const stream = await this.minioService.getObjectStream(item.objectKey);
    return { stream, name: item.name, mimeType: item.mimeType, size: item.size };
  }

  async getPreviewLink(
    userId: string,
    userEmail: string | undefined,
    fileId: string,
    expiresInSeconds = 300
  ): Promise<{
    url: string;
    expiresInSeconds: number;
    mimeType?: string;
    name: string;
    previewKind: PreviewKind;
  }> {
    const objectId = new Types.ObjectId(fileId);
    await this.permissionsService.requireAccess(userId, userEmail, objectId, SharePermission.VIEW);

    const item = await this.driveItemsService.model.findById(objectId);
    if (!item || item.isDeleted || item.type !== DriveItemType.FILE || !item.objectKey) {
      throw new NotFoundException("File not found");
    }

    // Fire-and-forget: requesting a preview counts as a view.
    this.driveItemsService.touchViewed(objectId).catch((err) => {
      this.logger.warn(`Failed to update lastViewedAt for ${objectId}: ${(err as Error).message}`);
    });

    const url = await this.minioService.getPresignedPreviewURL(item.objectKey, expiresInSeconds);

    return {
      url,
      expiresInSeconds,
      mimeType: item.mimeType,
      name: item.name,
      previewKind: classifyPreviewKind(item.mimeType, item.name),
    };
  }
}
