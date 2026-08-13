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
  TYPE = "type",
  MODIFIED = "modified",
  SIZE = "size",
}

export enum DriveItemSortDirection {
  ASC = "asc",
  DESC = "desc",
}
