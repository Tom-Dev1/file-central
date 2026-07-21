import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { shareKeys } from "../lib/query-keys";
import type { CreateShareRequest } from "../../../frontend/src/types/api.types";
import { sharesApi } from "@/apis";

export function useCreateShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateShareRequest) => sharesApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shareKeys.mine() });
    },
  });
}

export function useMyShares() {
  return useQuery({
    queryKey: shareKeys.mine(),
    queryFn: () => sharesApi.listMine(),
  });
}

export function useSharedWithMe() {
  return useQuery({
    queryKey: shareKeys.sharedWithMe(),
    queryFn: () => sharesApi.sharedWithMe(),
  });
}

export function useSharedFolderChildren(folderId: string) {
  return useQuery({
    queryKey: shareKeys.sharedFolderChildren(folderId),
    queryFn: () => sharesApi.sharedFolderChildren(folderId),
    enabled: !!folderId,
  });
}

export function useRevokeShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sharesApi.revoke(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shareKeys.all });
    },
  });
}

// --- Public link (no auth) ---

export function usePublicShareMetadata(token: string) {
  return useQuery({
    queryKey: shareKeys.publicMeta(token),
    queryFn: () => sharesApi.getPublicMetadata(token),
    enabled: !!token,
    retry: false, // an invalid/expired token won't become valid by retrying
  });
}

export function useDownloadPublicShare() {
  return useMutation({
    mutationFn: ({ token, fallbackName }: { token: string; fallbackName?: string }) =>
      sharesApi.downloadPublic(token, fallbackName),
  });
}
