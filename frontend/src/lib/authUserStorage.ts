export interface StoredUser {
  id?: string;
  name?: string;
  username?: string;
  email?: string;
  avatarUrl?: string;
}

const USER_STORAGE_KEY = "auth-user";

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

    const storage = persistent ? localStorage : sessionStorage;

    storage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  },

  getUser(): StoredUser | null {
    return parseUser(localStorage.getItem(USER_STORAGE_KEY)) ?? parseUser(sessionStorage.getItem(USER_STORAGE_KEY));
  },

  clearUser() {
    localStorage.removeItem(USER_STORAGE_KEY);
    sessionStorage.removeItem(USER_STORAGE_KEY);
  },
};
