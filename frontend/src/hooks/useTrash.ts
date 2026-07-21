import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { trashKeys, driveKeys } from "../lib/query-keys";
import { trashApi } from "@/apis";

export function useTrashList() {
  return useQuery({
    queryKey: trashKeys.list(),
    queryFn: () => trashApi.list(),
  });
}

export function useRestoreItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => trashApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trashKeys.all });
      queryClient.invalidateQueries({ queryKey: driveKeys.all }); // restored item reappears in its original folder
    },
  });
}

export function usePurgeItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => trashApi.purgeOne(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trashKeys.all });
    },
  });
}

export function usePurgeAllTrash() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => trashApi.purgeAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trashKeys.all });
    },
  });
}
