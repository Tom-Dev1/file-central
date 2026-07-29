//enums
export type DriveItemKind = "file" | "folder";
export type SharePermission = "view" | "download" | "edit";
export type ShareType = "user" | "public_link";

//core entities
export interface DriveItem {
  id: string;
  name: string;
  type: DriveItemKind;
  mimeType?: string;
  size?: number;
  extension?: string;
  ownerId: string;
  parentId: string | null;
  isDeleted: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  lastModifiedAt: string;
  lastViewedAt: string | null;
}

export interface Share {
  id: string;
  itemId: string;
  itemType: DriveItemKind;
  ownerId: string;
  sharedWithUserId: string | null;
  sharedWithEmail?: string | null;
  permission: SharePermission;
  shareType: ShareType;
  token?: string | null;
  expiresAt?: string | null;
  isRevoked: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
}

//wrapper
export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface ApiErrorShape {
  statusCode: number;
  path: string;
  timestamp: string;
  message: string | string[];
  error?: string;
}

//request DTOs
export interface RegisterRequest {
  email: string;
  name: string;
  username: string;
  password: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface CreateFolderRequest {
  name: string;
  parentId?: string | null;
}

export interface RenameRequest {
  name: string;
}

export interface MoveRequest {
  newParentId?: string | null;
}

export interface ListDriveParams {
  parentId?: string;
  type?: DriveItemKind;
  page?: number;
  limit?: number;
}

export interface SearchDriveParams {
  q?: string;
  type?: DriveItemKind;
  page?: number;
  limit?: number;
}

export interface CreateShareRequest {
  itemId: string;
  shareType: ShareType;
  permission: SharePermission;
  sharedWithEmail?: string;
  expiresAt?: string | null;
}

export interface SharedWithMeRow {
  share: Share;
  item: DriveItem;
}

export interface PublicShareMetadata {
  item: DriveItem;
  permission: SharePermission;
}

export interface DeletedIdsResponse {
  deletedIds: string[];
}

export interface RestoreResponse {
  restoredIds: string[];
}
