import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { tokenStorage } from "./token-storage";
import { ApiError, toApiError } from "./api-error";
import type { RefreshResponse } from "@/types/api.types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export const api = axios.create({
  baseURL: BASE_URL,
});

// dead (refresh token itself expired/revoked) - typically redirect to /login.
let onSessionExpired: (() => void) | null = null;
export function setOnSessionExpired(handler: () => void) {
  onSessionExpired = handler;
}

// Request interceptor: attach the access token
api.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

// If multiple requests get a 401 at the same time
let refreshPromise: Promise<string> | null = null;

function expireSession() {
  const hadSession = Boolean(
    tokenStorage.getAccessToken() || tokenStorage.getRefreshToken(),
  );
  tokenStorage.clear();

  if (hadSession) onSessionExpired?.();
}

async function requestAccessTokenRefresh(): Promise<string> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) {
    expireSession();
    throw new ApiError({
      statusCode: 401,
      path: "/auth/refresh",
      timestamp: new Date().toISOString(),
      message: "No refresh token available",
      error: "Unauthorized",
    });
  }

  try {
    // Use the base Axios client so refresh never recurses into this interceptor.
    const { data } = await axios.post<RefreshResponse>(`${BASE_URL}/auth/refresh`, {
      refreshToken,
    });

    tokenStorage.setTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch (error) {
    const apiError = toApiError(error);

    if ([400, 401, 403].includes(apiError.statusCode)) {
      expireSession();
    }

    throw apiError;
  }
}

export function refreshSession(): Promise<string> {
  refreshPromise ??= requestAccessTokenRefresh().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryableConfig | undefined;
    const status = error.response?.status;

    const isAuthEndpoint =
      original?.url?.includes("/auth/login") ||
      original?.url?.includes("/auth/register") ||
      original?.url?.includes("/auth/refresh");

    if (status === 401 && original && !original._retried && !isAuthEndpoint) {
      original._retried = true;

      try {
        // Share a single in-flight refresh across all concurrently-failing requests.
        const newAccessToken = await refreshSession();

        original.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(original);
      } catch (refreshError) {
        return Promise.reject(toApiError(refreshError));
      }
    }

    return Promise.reject(toApiError(error));
  }
);
