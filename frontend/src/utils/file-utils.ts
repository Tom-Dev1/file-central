import archiveIcon from "@/assets/icons/archive.svg";
import audioIcon from "@/assets/icons/audio.svg";
import codeIcon from "@/assets/icons/code.svg";
import documentIcon from "@/assets/icons/folder.svg";
import defaultFileIcon from "@/assets/icons/text.svg";
import folderIcon from "@/assets/icons/folder.svg";
import imageIcon from "@/assets/icons/image.svg";
import pdfIcon from "@/assets/icons/pdf.svg";
import presentationIcon from "@/assets/icons/presentation.svg";
import spreadsheetIcon from "@/assets/icons/spreadsheet.svg";
import textIcon from "@/assets/icons/text.svg";
import videoIcon from "@/assets/icons/video.svg";
import txtIcon from "@/assets/icons/txt.svg";
import zipIcon from "@/assets/icons/zip.svg";
import jsonIcon from "@/assets/icons/json.svg";
import typescriptIcon from "@/assets/icons/typescript.svg";

import type { DriveItem } from "@/types/api.types";

export type FileIconType =
  | "folder"
  | "document"
  | "pdf"
  | "spreadsheet"
  | "presentation"
  | "image"
  | "video"
  | "audio"
  | "archive"
  | "code"
  | "text"
  | "file"
  | "zip"
  | "json"
  | "typescript"
  | "txt";

export const fileIcons: Record<FileIconType, string> = {
  folder: folderIcon,
  document: documentIcon,
  pdf: pdfIcon,
  spreadsheet: spreadsheetIcon,
  presentation: presentationIcon,
  image: imageIcon,
  video: videoIcon,
  audio: audioIcon,

  archive: archiveIcon,
  code: codeIcon,
  text: textIcon,
  file: defaultFileIcon,
  txt: txtIcon,
  zip: zipIcon,
  json: jsonIcon,
  typescript: typescriptIcon,
};

const extensionTypeMap: Record<string, FileIconType> = {
  doc: "document",
  docx: "document",
  odt: "document",
  rtf: "document",

  pdf: "pdf",

  xls: "spreadsheet",
  xlsx: "spreadsheet",
  csv: "spreadsheet",
  ods: "spreadsheet",

  ppt: "presentation",
  pptx: "presentation",
  odp: "presentation",

  jpg: "image",
  jpeg: "image",
  png: "image",
  gif: "image",
  webp: "image",
  svg: "image",
  avif: "image",
  bmp: "image",

  mp4: "video",
  mov: "video",
  avi: "video",
  mkv: "video",
  webm: "video",

  mp3: "audio",
  wav: "audio",
  m4a: "audio",
  flac: "audio",
  aac: "audio",
  ogg: "audio",

  zip: "zip",
  rar: "archive",
  "7z": "archive",
  tar: "archive",
  gz: "archive",

  js: "code",
  jsx: "code",
  ts: "typescript",
  tsx: "code",
  html: "code",
  css: "code",
  scss: "code",
  java: "code",
  py: "code",
  php: "code",
  go: "code",
  rs: "code",
  cpp: "code",
  c: "code",
  cs: "code",
  sql: "code",
  json: "json",

  txt: "txt",
  md: "text",
  log: "text",
  xml: "text",
  yaml: "text",
  yml: "code",
};

function getFileExtension(item: DriveItem): string {
  if (item.extension) {
    return item.extension.replace(/^\./, "").toLowerCase();
  }

  const extension = item.name.split(".").pop();

  if (!extension || extension === item.name) {
    return "";
  }

  return extension.toLowerCase();
}

export function getDriveItemIconType(item: DriveItem): FileIconType {
  if (item.type === "folder") {
    return "folder";
  }

  const extension = getFileExtension(item);
  const typeFromExtension = extensionTypeMap[extension];

  if (typeFromExtension) {
    return typeFromExtension;
  }

  const mimeType = item.mimeType?.toLowerCase();

  if (mimeType?.startsWith("image/")) {
    return "image";
  }

  if (mimeType?.startsWith("video/")) {
    return "video";
  }

  if (mimeType?.startsWith("audio/")) {
    return "audio";
  }

  if (mimeType === "application/pdf") {
    return "pdf";
  }

  if (mimeType?.startsWith("text/")) {
    return "text";
  }

  return "file";
}

export function getDriveItemIcon(item: DriveItem): string {
  const iconType = getDriveItemIconType(item);

  return fileIcons[iconType] ?? fileIcons.file;
}
