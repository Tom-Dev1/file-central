import type { ApiErrorShape } from "@/types/api.types";
import { AxiosError } from "axios";

export class ApiError extends Error {
  readonly statusCode: number;
  readonly path?: string;
  readonly timestamp?: string;
  readonly errorType?: string;
  readonly messages: string[];

  constructor(shape: ApiErrorShape) {
    const messages = Array.isArray(shape.message) ? shape.message : [shape.message];
    super(messages.join(", "));
    this.name = "ApiError";
    this.statusCode = shape.statusCode;
    this.path = shape.path;
    this.timestamp = shape.timestamp;
    this.errorType = shape.error;
    this.messages = messages;
  }

  get isUnauthorized() {
    return this.statusCode === 401;
  }
  get isForbidden() {
    return this.statusCode === 403;
  }
  get isNotFound() {
    return this.statusCode === 404;
  }
  get isConflict() {
    return this.statusCode === 409;
  }
  get isValidationError() {
    return this.statusCode === 400;
  }
  get isRateLimited() {
    return this.statusCode === 429;
  }
}

//Converts any axios error (HTTP error response) into an ApiError.
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  const axiosError = error as AxiosError<ApiErrorShape>;

  if (axiosError?.response?.data) {
    return new ApiError(axiosError.response.data);
  }

  // Network error, timeout, CORS failure, request cancelled, etc. - the

  return new ApiError({
    statusCode: 0,
    path: axiosError?.config?.url ?? "unknown",
    timestamp: new Date().toISOString(),
    message: axiosError?.message || "Network error - could not reach the server",
    error: "NetworkError",
  });
}
