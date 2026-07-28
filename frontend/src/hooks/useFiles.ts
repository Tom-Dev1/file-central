import { useMutation, useQueryClient } from "@tanstack/react-query";
import { driveKeys } from "../lib/query-keys";
import { filesApi } from "@/apis";
import type { UploadFileOptions } from "@/apis/files.api";

export function useUploadFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (options: UploadFileOptions) => filesApi.upload(options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: driveKeys.all });
    },
  });
}

//download({ fileId, fallbackName: item.name })

export function useDownloadFile() {
  return useMutation({
    mutationFn: ({ fileId, fallbackName }: { fileId: string; fallbackName?: string }) =>
      filesApi.download(fileId, fallbackName),
  });
}

export function useFilePreviewLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["files", "preview-link"],

    mutationFn: (fileId: string) => filesApi.getPreviewObjectUrl(fileId),

    onSuccess: () => {
      /*
       * Preview updates lastOpenedAt, so cached drive lists
       * may need to be refreshed later.
       */
      void queryClient.invalidateQueries({
        queryKey: driveKeys.all,
      });
    },
  });
}
