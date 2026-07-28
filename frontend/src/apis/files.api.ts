import type { DriveItem } from "@/types/api.types";
import { api } from "../lib/axios";
import type { AxiosProgressEvent } from "axios";
import type { PreviewLinkResponse } from "@/types/file-preview.types";

export interface UploadFileOptions {
  file: File;
  parentId?: string | null;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

function parseFilename(contentDisposition: string | undefined, fallback: string): string {
  if (!contentDisposition) return fallback;
  const match = /filename="?([^"]+)"?/.exec(contentDisposition);
  return match ? decodeURIComponent(match[1]) : fallback;
}

export const filesApi = {
  upload: async ({ file, parentId, onProgress, signal }: UploadFileOptions): Promise<DriveItem> => {
    const form = new FormData();

    form.append("file", file);

    if (parentId?.trim()) {
      form.append("parentId", parentId.trim());
    }

    const response = await api.post<DriveItem>("/files/upload", form, {
      signal,

      onUploadProgress: (event: AxiosProgressEvent) => {
        let progress: number | undefined;

        if (typeof event.total === "number" && event.total > 0) {
          progress = Math.round((event.loaded / event.total) * 100);
        } else if (typeof event.progress === "number") {
          progress = Math.round(event.progress * 100);
        }

        if (progress === undefined) {
          return;
        }

        onProgress?.(Math.min(Math.max(progress, 0), 100));
      },
    });

    return response.data;
  },

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

  getPreviewObjectUrl: async (fileId: string): Promise<PreviewLinkResponse> => {
    const res = await api.get(`/files/${fileId}/preview-link`);
    return res.data;
  },
};
