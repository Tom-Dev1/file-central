import type { CreateFolderRequest, DriveItem } from "@/types/api.types";
import { api } from "../lib/axios";

export const foldersApi = {
  create: (body: CreateFolderRequest) => api.post<DriveItem>("/folders", body).then((res) => res.data),
};
