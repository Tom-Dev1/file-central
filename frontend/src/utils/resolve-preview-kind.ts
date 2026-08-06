import type { PreviewKind } from "@/types/file-preview.types";

const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "json",
  "xml",
  "csv",
  "log",
  "js",
  "jsx",
  "ts",
  "tsx",
  "css",
  "scss",
  "html",
  "htm",
  "py",
  "java",
  "c",
  "cpp",
  "cs",
  "go",
  "rs",
  "yaml",
  "yml",
]);

export function resolvePreviewKind(fileName: string): PreviewKind {
  const extension = getFileExtension(fileName);

  if (TEXT_EXTENSIONS.has(extension)) {
    return "text";
  }

  if (extension === "pdf") {
    return "pdf";
  }

  if (["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(extension)) {
    return "image";
  }

  if (["mp4", "webm", "mov"].includes(extension)) {
    return "video";
  }

  if (["mp3", "wav", "ogg", "m4a"].includes(extension)) {
    return "audio";
  }

  return "unsupported";
}

function getFileExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf(".");

  if (lastDotIndex <= 0 || lastDotIndex === fileName.length - 1) {
    return "";
  }

  return fileName.slice(lastDotIndex + 1).toLowerCase();
}
