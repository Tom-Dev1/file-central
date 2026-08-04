export enum DriveItemStatusEnum {
  UPLOADING = "uploading",
  ACTIVE = "active",
  FAILED = "failed",
  DELETING = "deleting",
}

export type DriveItemStatus = "uploading" | "active" | "failed" | "deleting";

export const DRIVE_ITEM_STATUS_VALUES: DriveItemStatus[] = ["uploading", "active", "failed", "deleting"];
