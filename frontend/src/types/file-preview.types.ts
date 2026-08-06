export type PreviewKind = "image" | "pdf" | "video" | "audio" | "text" | "unsupported";

/** Exact JSON returned by GET /files/:id/preview and /files/:id/download. */
export interface PreviewLinkResponse {
  url: string;
  expiresInSeconds: number;
}