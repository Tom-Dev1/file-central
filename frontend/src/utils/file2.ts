// import archiveIcon from "@/assets/file-icons/archive.svg";
// import audioIcon from "@/assets/file-icons/audio.svg";
import codeIcon from "@/assets/icons/code.svg";
import documentIcon from "@/assets/icons/folder.svg";
// import defaultFileIcon from "@/assets/file-icons/file.svg";
import folderIcon from "@/assets/icons/folder.svg";
// import imageIcon from "@/assets/file-icons/image.svg";
// import pdfIcon from "@/assets/file-icons/pdf.svg";
// import presentationIcon from "@/assets/file-icons/presentation.svg";
// import spreadsheetIcon from "@/assets/file-icons/spreadsheet.svg";
// import textIcon from "@/assets/file-icons/text.svg";
// import videoIcon from "@/assets/file-icons/video.svg";
import txtIcon from "@/assets/icons/txt.svg";
import type { DriveItem } from "@/types/api.types";
import {
  ArchiveIcon,
  FileAudio,
  FileImage,
  FileQuestion,
  FileSpreadsheet,
  FileType2,
  FileVideo,
  Presentation,
  TextIcon,
} from "lucide-react";
import type { ComponentType } from "react";

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
  | "txt";
type FileIconComponent = ComponentType<{
  className?: string;
  "aria-hidden"?: boolean;
}>;

export const fileIcons: Record<FileIconType, FileIconComponent | string> = {
  folder: folderIcon,
  document: documentIcon,
  pdf: FileType2,
  spreadsheet: FileSpreadsheet,
  presentation: Presentation,
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,

  archive: ArchiveIcon,
  code: codeIcon,
  text: TextIcon,
  file: FileQuestion,
  txt: txtIcon,
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

  zip: "archive",
  rar: "archive",
  "7z": "archive",
  tar: "archive",
  gz: "archive",

  js: "code",
  jsx: "code",
  ts: "code",
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
  json: "code",

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
