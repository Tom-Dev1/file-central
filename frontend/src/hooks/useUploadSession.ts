import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { uploadApi } from "@/apis";
import { driveKeys, uploadKeys } from "@/lib/query-keys";
import type { CompleteUploadRequest, InitUploadRequest } from "@/types/upload.types";

export function useUploadStatus(sessionId?: string, enabled = true) {
  return useQuery({
    queryKey: uploadKeys.status(sessionId ?? ""),
    queryFn: () => uploadApi.status(sessionId!),
    enabled: Boolean(sessionId) && enabled,
    retry: false,
  });
}

export function useInitUpload() {
  return useMutation({ mutationFn: (body: InitUploadRequest) => uploadApi.init(body) });
}

export function useCompleteUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, body }: { sessionId: string; body: CompleteUploadRequest }) =>
      uploadApi.complete(sessionId, body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: driveKeys.all }),
  });
}

/** Pauses the session; the backend retains MinIO parts so it can be resumed. */
export function usePauseUpload() {
  return useMutation({ mutationFn: (sessionId: string) => uploadApi.abort(sessionId) });
}