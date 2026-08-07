export interface StoredUser {
  id?: string;
  name?: string;
  username?: string;
  email?: string;
  avatarUrl?: string;
}

const USER_STORAGE_KEY = "auth-user";

function getStorage(persistent: boolean): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return persistent ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function readUser(persistent: boolean): StoredUser | null {
  try {
    return parseUser(getStorage(persistent)?.getItem(USER_STORAGE_KEY) ?? null);
  } catch {
    return null;
  }
}

function parseUser(value: string | null): StoredUser | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as StoredUser;
  } catch {
    return null;
  }
}

export const authUserStorage = {
  setUser(user: StoredUser, persistent: boolean) {
    this.clearUser();
    try {
      getStorage(persistent)?.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } catch {
      // Authentication still works from the in-memory token cache when
      // browser privacy settings deny Web Storage access.
    }
  },

  getUser(): StoredUser | null {
    return readUser(true) ?? readUser(false);
  },

  clearUser() {
    try {
      getStorage(true)?.removeItem(USER_STORAGE_KEY);
      getStorage(false)?.removeItem(USER_STORAGE_KEY);
    } catch {
      // Storage can be unavailable in privacy-restricted contexts.
    }
  },
};
