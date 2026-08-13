export interface FolderBreadcrumbItem {
  id: string;
  name: string;
}

export type DriveViewMode = "list" | "grid";

export type DriveSortField = "name" | "updatedAt" | "sizeBytes" | "type";

export type DriveSortDirection = "asc" | "desc";

export type DriveFolderPlacement = "onTop" | "mixed";

export interface DriveSortState {
  field: DriveSortField;
  direction: DriveSortDirection;
  folderPlacement: DriveFolderPlacement;
}
