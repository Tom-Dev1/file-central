// hooks/queries/drive-query-options.ts

import { driveApi } from "@/apis";
import { driveKeys } from "@/lib/query-keys";
import type { ListDriveParams } from "@/types/api.types";
import { queryOptions } from "@tanstack/react-query";

function normalizeListParams(params: ListDriveParams = {}): ListDriveParams {
  return {
    parentId: params.parentId?.trim() || undefined,
    limit: params.limit ?? 100,
    sort: params.sort ?? "name",
    direction: params.direction ?? "asc",
  };
}

export function driveListQueryOptions(params: ListDriveParams = {}) {
  const normalizedParams = normalizeListParams(params);

  return queryOptions({
    queryKey: driveKeys.list(normalizedParams),

    queryFn: ({ signal }) => driveApi.list(normalizedParams, signal),

    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,

    refetchOnWindowFocus: false,
  });
}
