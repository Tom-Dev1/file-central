import type { DriveItem } from "@/types/api.types";
import { api } from "../lib/axios";
import type { AxiosProgressEvent } from "axios";

export interface UploadFileOptions {
  file: File;
  parentId?: string | null;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

/** Extracts the filename from a Content-Disposition header, falling back to a default. */
function parseFilename(contentDisposition: string | undefined, fallback: string): string {
  if (!contentDisposition) return fallback;
  const match = /filename="?([^"]+)"?/.exec(contentDisposition);
  return match ? decodeURIComponent(match[1]) : fallback;
}

export const filesApi = {
  upload: ({ file, parentId, onProgress, signal }: UploadFileOptions) => {
    const form = new FormData();
    form.append("file", file);
    if (parentId) form.append("parentId", parentId);

    return api
      .post<DriveItem>("/files/upload", form, {
        signal,
        onUploadProgress: (event: AxiosProgressEvent) => {
          if (onProgress && event.total) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        },
      })
      .then((res) => res.data);
  },

  /** Downloads a file and triggers a browser "Save As" via a temporary object URL. */
  download: async (fileId: string, fallbackName = "download") => {
    const res = await api.get(`/files/${fileId}/download`, { responseType: "blob" });
    const filename = parseFilename(res.headers["content-disposition"], fallbackName);
    const url = URL.createObjectURL(res.data as Blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  },

  /** Returns an object URL for inline preview (e.g. <img src={url} />). Caller must revokeObjectURL when done. */
  getPreviewObjectUrl: async (fileId: string): Promise<string> => {
    const res = await api.get(`/files/${fileId}/preview`, { responseType: "blob" });
    return URL.createObjectURL(res.data as Blob);
  },
};
