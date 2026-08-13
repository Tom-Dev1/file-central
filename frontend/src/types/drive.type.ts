import type { DriveListSort, DriveSortDirection } from "./api.types";

export interface FolderBreadcrumbItem {
  id: string;
  name: string;
}

export type DriveViewMode = "list" | "grid";

export type DriveSortField = DriveListSort;

export interface DriveSortState {
  field: DriveSortField;
  direction: DriveSortDirection;
}
