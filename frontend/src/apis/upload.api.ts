import axios from "axios";
import type {
  InitUploadRequest,
  InitUploadResponse,
  UploadStatusResponse,
  CompleteUploadRequest,
  CompleteUploadResponse,
} from "@/types/upload.types";
import { api } from "../lib/axios";

// putToStorage: PUT byte to MinIO.
export const uploadApi = {
  init: (body: InitUploadRequest) => api.post<InitUploadResponse>("/uploads", body).then((res) => res.data),

  status: (uploadSessionId: string) =>
    api.get<UploadStatusResponse>(`/uploads/${uploadSessionId}/status`).then((res) => res.data),

  complete: (uploadSessionId: string, body: CompleteUploadRequest) =>
    api.post<CompleteUploadResponse>(`/uploads/${uploadSessionId}/complete`, body).then((res) => res.data),

  abort: (uploadSessionId: string) =>
    api.post<{ status: string }>(`/uploads/${uploadSessionId}/abort`).then((res) => res.data),

  putToStorage: async (
    presignedUrl: string,
    data: Blob,
    options?: {
      contentType?: string;
      onProgress?: (percent: number) => void;
    }
  ): Promise<string> => {
    const res = await axios.put(presignedUrl, data, {
      headers: options?.contentType ? { "Content-Type": options.contentType } : undefined,
      transformRequest: [(d) => d],
      onUploadProgress: (evt) => {
        if (options?.onProgress && evt.total) {
          options.onProgress(Math.round((evt.loaded / evt.total) * 100));
        }
      },
    });

    const etag = res.headers["etag"] as string | undefined;
    if (!etag) {
      throw new Error('Không đọc được ETag — kiểm tra MinIO CORS ExposeHeaders: ["ETag"]');
    }
    return etag;
  },
};
