import type { ApiError } from "@/lib/api-error";

type AuthAction = "login" | "register";

export function describeAuthError(error: ApiError, action: AuthAction): string {
  if (error.statusCode === 0) {
    return "We could not reach File Central. Check your connection and try again.";
  }

  if (error.isRateLimited) {
    return "Too many attempts were made. Please wait a moment before trying again.";
  }

  if (error.isUnauthorized && action === "login") {
    return "The username or password is incorrect.";
  }

  if (error.isConflict && action === "register") {
    return "An account already uses this username or email address.";
  }

  const details = error.messages.map((message) => message.trim()).filter(Boolean).join(" ");

  if (error.isValidationError && details) {
    return details;
  }

  if (error.statusCode >= 500) {
    return "File Central is temporarily unavailable. Please try again shortly.";
  }

  return details || (action === "login" ? "Unable to log in. Please try again." : "Unable to create your account. Please try again.");
}
