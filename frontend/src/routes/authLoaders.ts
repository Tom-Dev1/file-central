import { tokenStorage } from "@/lib/token-storage";
import { replace } from "react-router-dom";

const DASHBOARD_PATH = "/dashboard";
const LOGIN_PATH = "/auth/login";

export function guestOnlyLoader() {
  if (tokenStorage.hasAccessToken()) {
    return replace(DASHBOARD_PATH);
  }

  return null;
}

export function requireAuthLoader() {
  if (!tokenStorage.hasAccessToken()) {
    return replace(LOGIN_PATH);
  }

  return null;
}
