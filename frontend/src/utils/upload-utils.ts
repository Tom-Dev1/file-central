import type { UploadFolderProgress } from "@/apis/folder-upload";
import { ApiError } from "@/lib/api-error";
import axios from "axios";

export function getButtonLabel(progress: UploadFolderProgress | null): string {
  if (!progress) {
    return "Uploading folder...";
  }

  switch (progress.phase) {
    case "creating-folders":
      return "Creating folders...";

    case "uploading-files":
      return `Uploading ${clampPercent(progress.percent)}%`;

    case "done":
      return "Finishing upload...";

    default:
      return "Uploading folder...";
  }
}

export function getProgressTitle(folderName: string, progress: UploadFolderProgress): string {
  switch (progress.phase) {
    case "creating-folders":
      return `Creating ${folderName}`;

    case "uploading-files":
      return `Uploading ${folderName} — ${clampPercent(progress.percent)}%`;

    case "done":
      return `Finishing ${folderName}`;

    default:
      return `Uploading ${folderName}`;
  }
}

export function getProgressDescription(progress: UploadFolderProgress): string {
  if (progress.phase === "creating-folders") {
    return "Creating the folder structure...";
  }

  if (progress.phase === "done") {
    return "Refreshing the drive contents...";
  }

  const processedFiles = progress.completedFiles + progress.failedFiles;

  const progressText = `${processedFiles} of ${progress.totalFiles} files processed`;

  const failedText = progress.failedFiles > 0 ? ` · ${progress.failedFiles} failed` : "";

  const currentFileText = progress.currentFileName ? ` · ${shortenFileName(progress.currentFileName)}` : "";

  return `${progressText}${failedText}${currentFileText}`;
}

export function normalizeProgress(progress: UploadFolderProgress): UploadFolderProgress {
  return {
    ...progress,
    totalFiles: Math.max(progress.totalFiles, 0),
    completedFiles: Math.max(progress.completedFiles, 0),
    failedFiles: Math.max(progress.failedFiles, 0),
    percent: clampPercent(progress.percent),
  };
}

function clampPercent(value: number): number {
  return Math.min(Math.max(Math.round(value), 0), 100);
}

export function getRootFolderName(files: File[]): string {
  const relativePath = files[0]?.webkitRelativePath;

  if (!relativePath) {
    return "Selected folder";
  }

  const normalizedPath = relativePath.replace(/\\/g, "/");

  return normalizedPath.split("/")[0] || "Selected folder";
}

function shortenFileName(fileName: string): string {
  const normalizedPath = fileName.replace(/\\/g, "/");

  const pathParts = normalizedPath.split("/");

  if (pathParts.length <= 3) {
    return normalizedPath;
  }

  return `…/${pathParts.slice(-3).join("/")}`;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.errorType === "ERR_CANCELED") {
      return "The upload was canceled.";
    }

    return error.messages.join(", ");
  }

  if (axios.isCancel(error)) {
    return "The upload was canceled.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to upload this folder.";
}
