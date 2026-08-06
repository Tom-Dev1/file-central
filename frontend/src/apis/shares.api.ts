import { api } from "../lib/axios";
import {
  type CreateShareRequest,
  type CreateShareResponse,
  type DriveItem,
  type PublicShareMetadata,
  type Share,
  type SharedWithMeRow,
} from "@/types/api.types";

export const sharesApi = {
  create: (body: CreateShareRequest) => api.post<CreateShareResponse>("/shares", body).then((res) => res.data),

  listMine: () => api.get<Share[]>("/shares").then((res) => res.data),

  sharedWithMe: () => api.get<SharedWithMeRow[]>("/shares/shared-with-me").then((res) => res.data),

  sharedFolderChildren: (folderId: string) =>
    api.get<DriveItem[]>(`/shares/shared-with-me/${folderId}/items`).then((res) => res.data),

  revoke: (id: string) => api.delete<{ revoked: true }>(`/shares/${id}`).then((res) => res.data),

  // --- Public link (no auth needed - but going through `api` still works fine,
  // it just won't have an Authorization header to send since these routes ignore it) ---

  getPublicMetadata: (token: string) => api.get<PublicShareMetadata>(`/shares/public/${token}`).then((res) => res.data),

  downloadPublic: async (token: string, fallbackName = "download") => {
    const res = await api.get(`/shares/public/${token}/download`, { responseType: "blob" });
    const contentDisposition = res.headers["content-disposition"] as string | undefined;
    const match = contentDisposition ? /filename="?([^"]+)"?/.exec(contentDisposition) : null;
    const filename = match ? decodeURIComponent(match[1]) : fallbackName;

    const url = URL.createObjectURL(res.data as Blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  },
};
