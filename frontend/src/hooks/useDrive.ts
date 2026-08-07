import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { driveKeys } from "@/lib/query-keys";
import type { ListDriveParams, MoveRequest, RenameRequest, SearchDriveParams } from "@/types/api.types";
import { driveApi } from "@/apis/drive.api";
import { driveListQueryOptions } from "./queries/drive-query-options";
import { folderBreadcrumbQueryOptions } from "./queries/folder-query-options";

function withoutCursor<T extends { cursor?: string }>(params: T): Omit<T, "cursor"> {
  const { cursor, ...query } = params;
  void cursor;
  return query;
}

export function useDriveList(params: ListDriveParams = {}) {
  return useQuery(driveListQueryOptions(params));
}

/** Cursor pagination for TanStack Virtual / infinite scrolling in a folder. */
export function useInfiniteDriveList(params: ListDriveParams = {}) {
  const query = withoutCursor(params);
  return useInfiniteQuery({
    queryKey: driveKeys.infiniteList(query),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => driveApi.list({ ...query, cursor: pageParam ?? undefined }, signal),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}

export function useFolderBreadcrumbs(folderId?: string) {
  return useQuery({ ...folderBreadcrumbQueryOptions(folderId ?? ""), enabled: Boolean(folderId) });
}

export function useDriveSearch(params: SearchDriveParams) {
  return useQuery({
    queryKey: driveKeys.search(params),
    queryFn: ({ signal }) => driveApi.search(params, signal),
    enabled: Boolean(params.q?.trim()),
  });
}

/** Cursor pagination for virtualized search results. Reset this hook when q/type changes. */
export function useInfiniteDriveSearch(params: SearchDriveParams) {
  const query = withoutCursor(params);
  return useInfiniteQuery({
    queryKey: driveKeys.infiniteSearch(query),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => driveApi.search({ ...query, cursor: pageParam ?? undefined }, signal),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(query.q?.trim()),
  });
}

export function useRenameItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: RenameRequest }) => driveApi.rename(id, body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: driveKeys.all }),
  });
}

export function useMoveItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: MoveRequest }) => driveApi.move(id, body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: driveKeys.all }),
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => driveApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: driveKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["trash"] });
    },
  });
}
