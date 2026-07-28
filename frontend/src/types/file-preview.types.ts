export type PreviewKind = "image" | "pdf" | "video" | "audio" | "text" | "unsupported";

export interface PreviewLinkResponse {
  url: string;
  expiresInSeconds: number;
  mimeType?: string;
  name: string;
  previewKind: PreviewKind;
}
