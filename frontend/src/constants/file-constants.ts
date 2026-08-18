import type { FolderBreadcrumbItem } from "@/types/drive.type";
import type { DriveItem } from "@/types/api.types";

export function formatModifiedDate(dateValue: string): string {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatFileSize(bytes: number): string {
  if (bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];

  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);

  const value = bytes / 1024 ** unitIndex;

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatDriveFileSize(item: DriveItem): string {
  switch (item.fileStatus) {
    case "uploading":
      return "Uploading…";
    case "processing":
      return "Processing…";
    case "failed":
      return "Upload failed";
    default:
      return item.sizeBytes === null ? "—" : formatFileSize(Number(item.sizeBytes));
  }
}

export function getBreadcrumbParts(items: FolderBreadcrumbItem[]) {
  if (items.length <= 4) {
    return {
      visible: items,
      hidden: [],
    };
  }

  return {
    visible: [
      items[0],
      {
        id: "collapsed",
        name: "...",
      },
      items[items.length - 2],
      items[items.length - 1],
    ],

    hidden: items.slice(1, items.length - 2),
  };
}
