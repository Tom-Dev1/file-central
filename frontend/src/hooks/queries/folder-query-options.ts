import { driveApi } from "@/apis";
import { driveKeys } from "@/lib/query-keys";
import { queryOptions } from "@tanstack/react-query";

export function folderBreadcrumbQueryOptions(folderId: string) {
  return queryOptions({
    queryKey: driveKeys.breadcrumb(folderId),

    queryFn: ({ signal }) => driveApi.getFolderBreadcrumbs(folderId, signal),

    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,

    refetchOnWindowFocus: false,
  });
}
