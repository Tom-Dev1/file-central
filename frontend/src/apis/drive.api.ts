import type {
  DeletedIdsResponse,
  DriveItem,
  ListDriveParams,
  MoveRequest,
  PaginatedResponse,
  RenameRequest,
  SearchDriveParams,
} from "@/types/api.types";
import { api } from "../lib/axios";
import type { FolderBreadcrumbItem } from "@/types/drive.type";

export const driveApi = {
  list: async (params: ListDriveParams = {}, signal?: AbortSignal) =>
    api.get<PaginatedResponse<DriveItem>>("/drive", { params, signal }).then((res) => res.data),

  search: (params: SearchDriveParams = {}) =>
    api.get<PaginatedResponse<DriveItem>>("/drive/search", { params }).then((res) => res.data),

  rename: (id: string, body: RenameRequest) =>
    api.patch<DriveItem>(`/drive/${id}/rename`, body).then((res) => res.data),

  move: (id: string, body: MoveRequest) => api.patch<DriveItem>(`/drive/${id}/move`, body).then((res) => res.data),

  remove: (id: string) => api.delete<DeletedIdsResponse>(`/drive/${id}`).then((res) => res.data),

  getFolderBreadcrumbs: async (folderId: string, signal?: AbortSignal): Promise<FolderBreadcrumbItem[]> => {
    const response = await api.get<FolderBreadcrumbItem[]>(`/drive/${folderId}/ancestors`, { signal });

    return response.data;
  },
};
