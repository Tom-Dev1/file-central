export type PreviewKind = "image" | "pdf" | "video" | "audio" | "text" | "docx" | "spreadsheet" | "unsupported";

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

export function classifyPreviewKind(mimeType?: string, fileName?: string): PreviewKind {
  const mime = mimeType?.trim().toLowerCase() ?? "";

  const extension = getFileExtension(fileName);

  /*
   * Source-code extensions take priority because some extensions,
   * especially ".ts", are ambiguous at the operating-system level.
   */
  if (TEXT_EXTENSIONS.has(extension)) {
    return "text";
  }

  if (mime === "application/pdf" || extension === "pdf") {
    return "pdf";
  }

  if (mime.startsWith("image/") && mime !== "image/svg+xml") {
    return "image";
  }

  if (mime.startsWith("video/")) {
    return "video";
  }

  if (mime.startsWith("audio/")) {
    return "audio";
  }

  if (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime === "application/xml" ||
    mime === "application/javascript" ||
    mime === "application/typescript"
  ) {
    return "text";
  }

  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || extension === "docx") {
    return "docx";
  }

  if (
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    ["xls", "xlsx"].includes(extension)
  ) {
    return "spreadsheet";
  }

  return "unsupported";
}

function getFileExtension(fileName?: string): string {
  if (!fileName) {
    return "";
  }

  const lastDotIndex = fileName.lastIndexOf(".");

  if (lastDotIndex <= 0 || lastDotIndex === fileName.length - 1) {
    return "";
  }

  return fileName.slice(lastDotIndex + 1).toLowerCase();
}

export function resolvePreviewMimeType(mimeType?: string, fileName?: string): string {
  const extension = getFileExtension(fileName);

  const sourceMimeTypes: Record<string, string> = {
    ts: "text/plain; charset=utf-8",
    tsx: "text/plain; charset=utf-8",
    js: "text/plain; charset=utf-8",
    jsx: "text/plain; charset=utf-8",
    json: "application/json; charset=utf-8",
    css: "text/css; charset=utf-8",
    html: "text/plain; charset=utf-8",
    md: "text/plain; charset=utf-8",
    txt: "text/plain; charset=utf-8",
    py: "text/plain; charset=utf-8",
    java: "text/plain; charset=utf-8",
    xml: "text/plain; charset=utf-8",
    csv: "text/csv; charset=utf-8",
  };

  if (sourceMimeTypes[extension]) {
    return sourceMimeTypes[extension];
  }

  const normalized = mimeType?.trim().toLowerCase();

  if (!normalized) {
    return "application/octet-stream";
  }

  if (normalized === "text/html" || normalized === "application/xhtml+xml" || normalized === "image/svg+xml") {
    return "text/plain; charset=utf-8";
  }

  if (normalized.startsWith("text/") && !normalized.includes("charset=")) {
    return `${normalized}; charset=utf-8`;
  }

  return normalized;
}
