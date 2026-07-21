import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { driveKeys } from "../lib/query-keys";
import type {
  ListDriveParams,
  MoveRequest,
  RenameRequest,
  SearchDriveParams,
} from "../../../frontend/src/types/api.types";
import { driveApi } from "@/apis/drive.api";

export function useDriveList(params: ListDriveParams = {}) {
  return useQuery({
    queryKey: driveKeys.list(params),
    queryFn: () => driveApi.list(params),
  });
}

export function useDriveSearch(params: SearchDriveParams) {
  return useQuery({
    queryKey: driveKeys.search(params),
    queryFn: () => driveApi.search(params),
    enabled: !!params.q, // don't fire an empty search until the user actually types something
  });
}

export function useRenameItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: RenameRequest }) => driveApi.rename(id, body),
    onSuccess: () => {
      // Renamed item could be showing in any list/search view currently
      // cached - simplest correct approach is to invalidate all drive
      // queries rather than trying to patch every possible cache entry.
      queryClient.invalidateQueries({ queryKey: driveKeys.all });
    },
  });
}

export function useMoveItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: MoveRequest }) => driveApi.move(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: driveKeys.all });
    },
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => driveApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: driveKeys.all });
      queryClient.invalidateQueries({ queryKey: ["trash"] }); // deleted item now shows up in Trash
    },
  });
}
