export enum StorageScanStatus {
  NOT_REQUESTED = "not_requested",
  PENDING = "pending",
  CLEAN = "clean",
  INFECTED = "infected",
  FAILED = "failed",
}

export enum StorageObjectState {
  ACTIVE = "active",
  DELETING = "deleting",
  DELETE_FAILED = "delete_failed",
}
export enum StorageProvider {
  LOCAL = "local",
  MINIO = "minio",
  S3 = "s3",
}
