import { useMutation, useQueryClient } from "@tanstack/react-query";

import { driveKeys } from "../lib/query-keys";
import type { CreateFolderRequest } from "../../../frontend/src/types/api.types";
import { foldersApi } from "@/apis";

export function useCreateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateFolderRequest) => foldersApi.create(body),
    onSuccess: () => {
      // New `/drive?parentId=...` listing it landed
      queryClient.invalidateQueries({ queryKey: driveKeys.all });
    },
  });
}
