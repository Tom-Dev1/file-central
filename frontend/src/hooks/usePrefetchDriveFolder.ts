import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { driveListQueryOptions } from "@/hooks/queries/drive-query-options";
import { folderBreadcrumbQueryOptions } from "@/hooks/queries/folder-query-options";
import type { DriveItem } from "@/types/api.types";

export function usePrefetchDriveFolder() {
  const queryClient = useQueryClient();

  return useCallback(
    (item: DriveItem) => {
      if (item.type !== "folder") {
        return;
      }

      void Promise.all([
        queryClient.prefetchQuery(
          driveListQueryOptions({
            parentId: item.id,
            limit: 100,
          })
        ),

        queryClient.prefetchQuery(folderBreadcrumbQueryOptions(item.id)),
      ]);
    },
    [queryClient]
  );
}
