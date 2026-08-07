const ACCESS_TOKEN_KEY = "fc_access_token";
const REFRESH_TOKEN_KEY = "fc_refresh_token";

let accessTokenCache: string | null = null;
let refreshTokenCache: string | null = null;
let persistentCache: boolean | null = null;
let hydrated = false;

function hasWebStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage && !!window.sessionStorage;
  } catch {
    return false;
  }
}

function hydrate() {
  if (hydrated) return;
  hydrated = true;
  if (!hasWebStorage()) return;

  const persistentAccessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  const persistentRefreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
  const sessionAccessToken = window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
  const sessionRefreshToken = window.sessionStorage.getItem(REFRESH_TOKEN_KEY);

  if (persistentAccessToken && persistentRefreshToken) {
    accessTokenCache = persistentAccessToken;
    refreshTokenCache = persistentRefreshToken;
    persistentCache = true;
    return;
  }

  accessTokenCache = sessionAccessToken;
  refreshTokenCache = sessionRefreshToken;
  persistentCache = sessionAccessToken && sessionRefreshToken ? false : null;
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
   * @param persist When true, tokens survive a browser restart in
   *   localStorage. When false, they live in sessionStorage for the current
   *   browser tab. When omitted (for example during token refresh), the
   *   current storage choice is preserved.
   */
  setTokens(accessToken: string, refreshToken: string, persist?: boolean) {
    hydrate();
    const shouldPersist = persist ?? persistentCache ?? true;

    accessTokenCache = accessToken;
    refreshTokenCache = refreshToken;
    persistentCache = shouldPersist;
    hydrated = true;
    if (hasWebStorage()) {
      const targetStorage = shouldPersist ? window.localStorage : window.sessionStorage;
      const staleStorage = shouldPersist ? window.sessionStorage : window.localStorage;

      staleStorage.removeItem(ACCESS_TOKEN_KEY);
      staleStorage.removeItem(REFRESH_TOKEN_KEY);
      targetStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      targetStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
  },

  clear() {
    accessTokenCache = null;
    refreshTokenCache = null;
    persistentCache = null;
    hydrated = true;
    if (hasWebStorage()) {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
      window.localStorage.removeItem(REFRESH_TOKEN_KEY);
      window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
      window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  },
  hasAccessToken() {
    return Boolean(this.getAccessToken());
  },
};
