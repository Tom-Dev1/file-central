import { refreshSession } from "./axios";
import { tokenStorage } from "./token-storage";

const REFRESH_EARLY_MS = 30_000;
const NETWORK_RETRY_MS = 60_000;
const MAX_TIMER_DELAY_MS = 2_147_000_000;

function readTokenExpiry(accessToken: string): number | null {
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = JSON.parse(window.atob(padded)) as { exp?: unknown };

    return typeof decoded.exp === "number" ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function startAuthSessionLifecycle() {
  let refreshTimer: number | null = null;
  let stopped = false;

  const clearRefreshTimer = () => {
    if (refreshTimer === null) return;
    window.clearTimeout(refreshTimer);
    refreshTimer = null;
  };

  const scheduleRefresh = () => {
    clearRefreshTimer();
    if (stopped) return;

    const accessToken = tokenStorage.getAccessToken();
    const refreshToken = tokenStorage.getRefreshToken();
    if (!accessToken || !refreshToken) return;

    const expiresAt = readTokenExpiry(accessToken);
    if (expiresAt === null) return;

    const delay = Math.min(
      Math.max(expiresAt - Date.now() - REFRESH_EARLY_MS, 0),
      MAX_TIMER_DELAY_MS,
    );

    refreshTimer = window.setTimeout(() => {
      refreshTimer = null;

      void refreshSession().catch(() => {
        if (tokenStorage.getAccessToken() && tokenStorage.getRefreshToken()) {
          refreshTimer = window.setTimeout(scheduleRefresh, NETWORK_RETRY_MS);
        }
      });
    }, delay);
  };

  const unsubscribe = tokenStorage.subscribe(scheduleRefresh);
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") scheduleRefresh();
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  scheduleRefresh();

  return () => {
    stopped = true;
    clearRefreshTimer();
    unsubscribe();
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}
