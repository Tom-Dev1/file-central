export type DriveItemKind = "file" | "folder";
export type FileStatus = "uploading" | "processing" | "active" | "failed";
export type DriveListSort = "name" | "modified" | "type" | "size";
export type DriveSortDirection = "asc" | "desc";
export type SharePermission = "view" | "download" | "edit";
export type ShareType = "user" | "public_link";

/** Exact JSON shape returned by DriveItemResponseDto. */
export interface DriveItem {
  id: string;
  name: string;
  type: DriveItemKind;
  fileStatus: FileStatus | null;
  mimeType: string | null;
  /** Int64 serialized as a string by the backend. */
  sizeBytes: string | null;
  extension: string | null;
  childCount: number | null;
  ownerId: string;
  parentId: string | null;
  isTrashed: boolean;
  trashedAt: string | null;
  metadataVersion: number;
  createdAt: string;
  updatedAt: string;
  lastModifiedAt: string;
}

/** Exact JSON shape returned by ShareResponseDto. */
export interface Share {
  id: string;
  itemId: string;
  itemType: DriveItemKind;
  ownerId: string;
  sharedWithUserId: string | null;
  sharedWithEmail?: string | null;
  permission: SharePermission;
  shareType: ShareType;
  expiresAt?: string | null;
  isRevoked: boolean;
  createdAt: string;
}

export interface CreateShareResponse {
  share: Share;
  token: string | null;
}

export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
}

export interface CursorPage<T> {
  items: T[];
  limit: number;
  nextCursor: string | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface ApiErrorShape {
  statusCode: number;
  path: string;
  timestamp: string;
  message: string | string[];
  error?: string;
}

export interface RegisterRequest { email: string; name: string; username: string; password: string; }
export interface LoginRequest { username: string; password: string; }
export interface RefreshRequest { refreshToken: string; }
export interface CreateFolderRequest { name: string; parentId?: string | null; }
export interface RenameRequest { name: string; expectedMetadataVersion: number; }
export interface MoveRequest { newParentId?: string | null; expectedMetadataVersion: number; }
export interface BulkMoveItemRequest { id: string; expectedMetadataVersion: number; }
export interface BulkMoveRequest { items: BulkMoveItemRequest[]; newParentId?: string | null; }
export interface BulkTrashRequest { itemIds: string[]; }
export interface ListDriveParams { parentId?: string; cursor?: string; limit?: number; sort?: DriveListSort; direction?: DriveSortDirection; }
export interface SearchDriveParams { q?: string; type?: DriveItemKind; cursor?: string; limit?: number; }
export interface CreateShareRequest { itemId: string; shareType: ShareType; permission: SharePermission; sharedWithEmail?: string; expiresAt?: string | null; }
export interface SharedWithMeRow { share: Share; item: DriveItem; }
export interface PublicShareMetadata { item: DriveItem; permission: SharePermission; }
export interface DeletedIdsResponse { deletedIds: string[]; }
export interface MovedIdsResponse { movedIds: string[]; }
export interface RestoreResponse { restoredIds: string[]; }
export interface PresignedFileUrlResponse { url: string; expiresInSeconds: number; }
