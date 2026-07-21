import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tokenStorage } from "../lib/token-storage";
import type { AuthResponse, LoginRequest, RegisterRequest, User } from "../../../frontend/src/types/api.types";
import { authApi } from "@/apis/auth.api";
import type { ApiError } from "@/lib/api-error";

const CURRENT_USER_KEY = "fc_current_user";

function persistUser(user: User) {
  window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
}

export function getStoredUser(): User | null {
  const raw = window.localStorage.getItem(CURRENT_USER_KEY);
  return raw ? (JSON.parse(raw) as User) : null;
}

function onAuthSuccess(data: AuthResponse) {
  tokenStorage.setTokens(data.accessToken, data.refreshToken);
  persistUser(data.user);
}

export function useRegister() {
  return useMutation({
    mutationFn: (body: RegisterRequest) => authApi.register(body),
    onSuccess: onAuthSuccess,
  });
}

export function useLogin() {
  return useMutation<AuthResponse, ApiError, RegisterRequest>({
    mutationFn: (body: LoginRequest) => authApi.login(body),
    onSuccess: onAuthSuccess,
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
    onSuccess: () => {
      tokenStorage.clear();
      window.localStorage.removeItem(CURRENT_USER_KEY);
      queryClient.clear();
    },
  });
}

export function useLogoutAll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.logoutAll(),
    onSuccess: () => {
      tokenStorage.clear();
      window.localStorage.removeItem(CURRENT_USER_KEY);
      queryClient.clear();
    },
  });
}
