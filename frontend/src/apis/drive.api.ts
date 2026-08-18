import type {
  BulkMoveRequest,
  DeletedIdsResponse,
  MovedIdsResponse,
  BulkTrashRequest,
  DriveItem,
  ListDriveParams,
  MoveRequest,
  CursorPage,
  RenameRequest,
  SearchDriveParams,
} from "@/types/api.types";
import { api } from "../lib/axios";
import type { FolderBreadcrumbItem } from "@/types/drive.type";

export const driveApi = {
  list: async (params: ListDriveParams = {}, signal?: AbortSignal) =>
    api.get<CursorPage<DriveItem>>("/drive", { params, signal }).then((res) => res.data),

  search: (params: SearchDriveParams = {}, signal?: AbortSignal) =>
    api.get<CursorPage<DriveItem>>("/drive/search", { params, signal }).then((res) => res.data),

  getById: (id: string, signal?: AbortSignal) =>
    api.get<DriveItem>(`/drive/${id}`, { signal }).then((res) => res.data),

  rename: (id: string, body: RenameRequest) =>
    api.patch<DriveItem>(`/drive/${id}/rename`, body).then((res) => res.data),

  move: (id: string, body: MoveRequest) => api.patch<DriveItem>(`/drive/${id}/move`, body).then((res) => res.data),

  moveMany: (body: BulkMoveRequest) =>
    api.patch<MovedIdsResponse>("/drive/bulk/move", body).then((res) => res.data),

  remove: (id: string) => api.delete<DeletedIdsResponse>(`/drive/${id}`).then((res) => res.data),

  removeMany: (body: BulkTrashRequest) =>
    api.delete<DeletedIdsResponse>("/drive/bulk", { data: body }).then((res) => res.data),

  getFolderBreadcrumbs: async (folderId: string, signal?: AbortSignal): Promise<FolderBreadcrumbItem[]> => {
    const response = await api.get<FolderBreadcrumbItem[]>(`/drive/${folderId}/ancestors`, { signal });

    return response.data;
  },
};
