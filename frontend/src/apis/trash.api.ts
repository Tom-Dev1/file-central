import type { DeletedIdsResponse, DriveItem, RestoreResponse } from "@/types/api.types";
import { api } from "../lib/axios";

export const trashApi = {
  list: () => api.get<DriveItem[]>("/trash").then((res) => res.data),

  restore: (id: string) => api.patch<RestoreResponse>(`/trash/${id}/restore`).then((res) => res.data),

  purgeOne: (id: string) => api.delete<DeletedIdsResponse>(`/trash/${id}`).then((res) => res.data),

  purgeAll: () => api.delete<DeletedIdsResponse>("/trash").then((res) => res.data),
};
