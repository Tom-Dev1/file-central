import { Types } from "mongoose";

import { DriveItemType, FileStatus } from "../../modules/drive-items/domain/enums/drive-item.enum";

export interface DriveItemBase {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  parentId: Types.ObjectId | null;
  ancestorIds: Types.ObjectId[];
  name: string;
  normalizedName: string;
  isTrashed: boolean;
  trashedAt: Date | null;
  metadataVersion: number;
  createdAt: Date;
  updatedAt: Date;
  lastModifiedAt: Date;
}

export interface FileDriveItem extends DriveItemBase {
  type: DriveItemType.FILE;
  storageObjectId: Types.ObjectId | null;
  fileStatus: FileStatus;
  mimeType: string | null;
  sizeBytes: bigint | null;
  extension: string | null;
  childCount: null;
}

export interface FolderDriveItem extends DriveItemBase {
  type: DriveItemType.FOLDER;
  storageObjectId: null;
  fileStatus: null;
  mimeType: null;
  sizeBytes: null;
  extension: null;
  childCount: number;
}

export type DriveItem = FileDriveItem | FolderDriveItem;

export interface DriveItemResponse {
  id: string;
  ownerId: string;
  parentId: string | null;
  name: string;
  type: DriveItemType;
  fileStatus: FileStatus | null;
  mimeType: string | null;
  sizeBytes: string | null;
  extension: string | null;
  childCount: number | null;
  isTrashed: boolean;
  trashedAt: string | null;
  metadataVersion: number;
  createdAt: string;
  updatedAt: string;
  lastModifiedAt: string;
}
