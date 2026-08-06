import axios from "axios";
import type {
  InitUploadRequest,
  InitUploadResponse,
  UploadStatusResponse,
  CompleteUploadRequest,
  CompleteUploadResponse,
} from "@/types/upload.types";
import { api } from "../lib/axios";

/**
 * uploadApi — theo đúng pattern authApi của bạn.
 *
 * LƯU Ý QUAN TRỌNG:
 * - init/status/complete/abort: gọi backend NestJS qua instance `api`
 *   (interceptor tự gắn Authorization + baseURL).
 * - putToStorage: PUT byte THẲNG lên MinIO. Phải dùng `axios` TRẦN, KHÔNG dùng
 *   instance `api` — vì interceptor của `api` gắn Authorization/baseURL sẽ phá
 *   chữ ký presigned của MinIO (gây 403). Presigned URL đã tự chứa chữ ký rồi.
 */
export const uploadApi = {
  init: (body: InitUploadRequest) => api.post<InitUploadResponse>("/uploads", body).then((res) => res.data),

  status: (uploadSessionId: string) =>
    api.get<UploadStatusResponse>(`/uploads/${uploadSessionId}/status`).then((res) => res.data),

  complete: (uploadSessionId: string, body: CompleteUploadRequest) =>
    api.post<CompleteUploadResponse>(`/uploads/${uploadSessionId}/complete`, body).then((res) => res.data),

  abort: (uploadSessionId: string) =>
    api.post<{ status: string }>(`/uploads/${uploadSessionId}/abort`).then((res) => res.data),

  /**
   * PUT một chunk (hoặc cả file với single) thẳng lên MinIO qua presigned URL.
   * Trả về ETag để dùng ở bước complete.
   *
   * @param onProgress callback tiến trình (0-100) cho riêng request này.
   */
  putToStorage: async (
    presignedUrl: string,
    data: Blob,
    options?: {
      contentType?: string;
      onProgress?: (percent: number) => void;
    }
  ): Promise<string> => {
    const res = await axios.put(presignedUrl, data, {
      // KHÔNG kèm Authorization. Chỉ Content-Type nếu presigned ký kèm.
      headers: options?.contentType ? { "Content-Type": options.contentType } : undefined,
      // Tắt transform để axios không đụng vào Blob.
      transformRequest: [(d) => d],
      onUploadProgress: (evt) => {
        if (options?.onProgress && evt.total) {
          options.onProgress(Math.round((evt.loaded / evt.total) * 100));
        }
      },
    });

    // axios chuẩn hoá header về lowercase. Cần MinIO CORS ExposeHeaders: ["ETag"].
    const etag = res.headers["etag"] as string | undefined;
    if (!etag) {
      throw new Error('Không đọc được ETag — kiểm tra MinIO CORS ExposeHeaders: ["ETag"]');
    }
    return etag;
  },
};
