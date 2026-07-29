import type { ListDriveParams, SearchDriveParams } from "@/types/api.types";

export const driveKeys = {
  all: ["drive"] as const,
  list: (params: ListDriveParams) => [...driveKeys.all, "list", params] as const,
  search: (params: SearchDriveParams) => [...driveKeys.all, "search", params] as const,
  breadcrumbs: () => [...driveKeys.all, "breadcrumbs"] as const,
  breadcrumb: (folderId: string) => [...driveKeys.breadcrumbs(), folderId] as const,
};

export const trashKeys = {
  all: ["trash"] as const,
  list: () => [...trashKeys.all, "list"] as const,
};

export const shareKeys = {
  all: ["shares"] as const,
  mine: () => [...shareKeys.all, "mine"] as const,
  sharedWithMe: () => [...shareKeys.all, "shared-with-me"] as const,
  sharedFolderChildren: (folderId: string) => [...shareKeys.all, "shared-with-me", folderId, "items"] as const,
  publicMeta: (token: string) => [...shareKeys.all, "public", token] as const,
};

export const fileKeys = {
  all: ["files"] as const,
  preview: ["preview"] as const,
};
