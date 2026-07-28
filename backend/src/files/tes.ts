// import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
// import { Types } from "mongoose";

// import { DriveItemsService } from "../drive-items/drive-items.service";
// import { DriveItemType } from "../drive-items/schemas/drive-item.schema";
// import { PermissionsService } from "../permissions/permissions.service";
// import { SharePermission } from "../shares/schemas/share.schema";
// import { classifyPreviewKind, PreviewKind } from "./previewkind";
// import { MinioService } from "src/storage/minio.service";

// export interface PreviewLinkResult {
//   url: string;
//   expiresInSeconds: number;
//   expiresAt: string;
//   mimeType: string;
//   name: string;
//   size: number;
//   previewKind: PreviewKind;
// }

// @Injectable()
// export class FilesService {
//   private readonly defaultPreviewExpiration = 300;

//   private readonly maximumPreviewExpiration = 1_800;

//   private readonly openedWriteThrottleMs = 30_000;

//   constructor(
//     private readonly minioService: MinioService,

//     private readonly permissionsService: PermissionsService,

//     private readonly driveItemsService: DriveItemsService
//   ) {}

//   async getPreviewLink(
//     userId: string,
//     userEmail: string | undefined,
//     fileId: string,
//     expiresInSeconds = this.defaultPreviewExpiration
//   ): Promise<PreviewLinkResult> {
//     if (!Types.ObjectId.isValid(fileId)) {
//       throw new BadRequestException("Invalid file ID.");
//     }

//     const objectId = new Types.ObjectId(fileId);

//     await this.permissionsService.requireAccess(userId, userEmail, objectId, SharePermission.VIEW);

//     const item = await this.driveItemsService.model
//       .findOne({
//         _id: objectId,
//         isDeleted: false,
//         type: DriveItemType.FILE,
//         objectKey: {
//           $exists: true,
//           $type: "string",
//           $ne: "",
//         },
//       })
//       .select({
//         name: 1,
//         mimeType: 1,
//         size: 1,
//         objectKey: 1,
//         lastOpenedAt: 1,
//       })
//       .lean()
//       .exec();

//     if (!item?.objectKey) {
//       throw new NotFoundException("File not found.");
//     }

//     const safeExpiresInSeconds = this.normalizeExpiration(expiresInSeconds);

//     const mimeType = item.mimeType ?? "application/octet-stream";

//     const url = await this.minioService.getPresignedPreviewURL(item.objectKey, {
//       expiresInSeconds: safeExpiresInSeconds,
//       mimeType,
//       fileName: item.name,
//     });

//     const openedAt = new Date();

//     await this.markFileAsOpened(objectId, openedAt);

//     return {
//       url,
//       expiresInSeconds: safeExpiresInSeconds,

//       expiresAt: new Date(openedAt.getTime() + safeExpiresInSeconds * 1000).toISOString(),

//       mimeType,
//       name: item.name,
//       size: item.size ?? 0,

//       previewKind: classifyPreviewKind(mimeType, item.name),
//     };
//   }

//   private normalizeExpiration(expiresInSeconds: number): number {
//     if (!Number.isFinite(expiresInSeconds)) {
//       return this.defaultPreviewExpiration;
//     }

//     return Math.min(Math.max(Math.trunc(expiresInSeconds), 60), this.maximumPreviewExpiration);
//   }

//   private async markFileAsOpened(fileId: Types.ObjectId, openedAt: Date): Promise<void> {
//     const threshold = new Date(openedAt.getTime() - this.openedWriteThrottleMs);

//     await this.driveItemsService.model
//       .updateOne(
//         {
//           _id: fileId,
//           isDeleted: false,
//           type: DriveItemType.FILE,

//           $or: [
//             {
//               lastOpenedAt: null,
//             },
//             {
//               lastOpenedAt: {
//                 $exists: false,
//               },
//             },
//             {
//               lastOpenedAt: {
//                 $lt: threshold,
//               },
//             },
//           ],
//         },
//         {
//           $set: {
//             lastOpenedAt: openedAt,
//           },
//         },
//         {
//           timestamps: false,
//         }
//       )
//       .exec();
//   }
// }
