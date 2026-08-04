import { DriveItemType, FileStatus } from "../enums/drive-item.enum";

export class OwnerSummaryResponseDto {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export class DriveItemResponseDto {
  id: string;
  parentId: string | null;
  ancestorIds: string[];

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

  owner?: OwnerSummaryResponseDto;
}

export class DriveItemCursorPageResponseDto {
  items: DriveItemResponseDto[];
  nextCursor: string | null;
}
