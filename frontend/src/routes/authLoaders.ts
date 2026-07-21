import { tokenStorage } from "@/lib/token-storage";
import { replace } from "react-router-dom";

const HOME_PATH = "/";
const LOGIN_PATH = "/auth/login";

export function guestOnlyLoader() {
  if (tokenStorage.hasAccessToken()) {
    return replace(HOME_PATH);
  }

  return null;
}

export function requireAuthLoader() {
  if (!tokenStorage.hasAccessToken()) {
    return replace(LOGIN_PATH);
  }

  return null;
}
