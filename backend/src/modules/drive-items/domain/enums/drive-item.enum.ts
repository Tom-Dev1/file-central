export enum DriveItemType {
  FILE = "file",
  FOLDER = "folder",
}

export enum FileStatus {
  UPLOADING = "uploading",
  PROCESSING = "processing",
  ACTIVE = "active",
  FAILED = "failed",
}

export enum DriveItemSortBy {
  NAME = "name",
  UPDATED_AT = "updatedAt",
  SIZE_BYTES = "sizeBytes",
}

export enum SortOrder {
  ASC = "asc",
  DESC = "desc",
}
