import type { ComponentType } from "react";
import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileJson,
  FileKey,
  FileQuestion,
  FileSpreadsheet,
  FileText,
  FileType2,
  FileVideo,
  Folder,
  Presentation,
} from "lucide-react";
import FileTXT from "@/assets/icons/txt.svg";
export type FileType =
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
  | "json"
  | "text"
  | "certificate"
  | "file"
  | "txt"
  | "unknown";

type FileIconComponent = ComponentType<{
  className?: string;
  "aria-hidden"?: boolean;
}>;

export const fileIcons: Record<FileType, string | FileIconComponent> = {
  folder: Folder,
  document: FileText,
  pdf: FileType2,
  spreadsheet: FileSpreadsheet,
  presentation: Presentation,
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  archive: FileArchive,
  code: FileCode,
  json: FileJson,
  text: FileText,
  certificate: FileKey,
  file: File,
  //
  txt: FileTXT,
  unknown: FileQuestion,
};
