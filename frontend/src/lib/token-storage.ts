const ACCESS_TOKEN_KEY = "fc_access_token";
const REFRESH_TOKEN_KEY = "fc_refresh_token";

let accessTokenCache: string | null = null;
let refreshTokenCache: string | null = null;
let hydrated = false;

function hasLocalStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

function hydrate() {
  if (hydrated) return;
  hydrated = true;
  if (!hasLocalStorage()) return;
  accessTokenCache = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  refreshTokenCache = window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export const tokenStorage = {
  getAccessToken(): string | null {
    hydrate();
    return accessTokenCache;
  },

  getRefreshToken(): string | null {
    hydrate();
    return refreshTokenCache;
  },

  /**
   * @param persist When true (default), tokens survive a browser restart
   *   (written to localStorage). When false ("Remember me" unchecked),
   *   tokens still work for the current tab/session via the in-memory
   *   cache, but are NOT written to localStorage - so a reload or new
   *   tab won't find them and the person has to log in again.
   */
  setTokens(accessToken: string, refreshToken: string, persist = true) {
    accessTokenCache = accessToken;
    refreshTokenCache = refreshToken;
    hydrated = true;
    if (hasLocalStorage()) {
      if (persist) {
        window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
        window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      } else {
        window.localStorage.removeItem(ACCESS_TOKEN_KEY);
        window.localStorage.removeItem(REFRESH_TOKEN_KEY);
      }
    }
  },

  clear() {
    accessTokenCache = null;
    refreshTokenCache = null;
    hydrated = true;
    if (hasLocalStorage()) {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
      window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  },
  hasAccessToken() {
    return Boolean(this.getAccessToken());
  },
};
