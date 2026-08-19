import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tokenStorage } from "../lib/token-storage";
import type { AuthResponse, LoginRequest, RegisterRequest } from "@/types/api.types";
import { authApi } from "@/apis/auth.api";
import type { ApiError } from "@/lib/api-error";
import { authUserStorage } from "@/lib/authUserStorage";

export interface LoginVariables {
  credentials: LoginRequest;
  remember: boolean;
}

function persistAuth(data: AuthResponse, persistent: boolean) {
  tokenStorage.setTokens(data.accessToken, data.refreshToken, persistent);
  authUserStorage.setUser(data.user, persistent);
}

export function useRegister() {
  return useMutation<AuthResponse, ApiError, RegisterRequest>({
    mutationFn: (body: RegisterRequest) => authApi.register(body),
    onSuccess: (data) => persistAuth(data, true),
  });
}

export function useLogin() {
  return useMutation<AuthResponse, ApiError, LoginVariables>({
    mutationFn: ({ credentials }) => authApi.login(credentials),
    onSuccess: (data, { remember }) => persistAuth(data, remember),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      const refreshToken = tokenStorage.getRefreshToken();
      if (!refreshToken) return Promise.resolve({ loggedOut: true as const });
      return authApi.logout(refreshToken);
    },
    onSettled: () => {
      tokenStorage.clear();
      authUserStorage.clearUser();
      queryClient.clear();
    },
  });
}
