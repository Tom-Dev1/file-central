import { useCallback, useState } from "react";

import type { DriveViewMode } from "@/types/drive.type";

const DRIVE_VIEW_MODE_STORAGE_KEY = "file-central-drive-view-mode";

function isDriveViewMode(value: string | null): value is DriveViewMode {
  return value === "list" || value === "grid";
}

function getInitialDriveViewMode(defaultMode: DriveViewMode): DriveViewMode {
  if (typeof window === "undefined") return defaultMode;

  try {
    const storedMode = window.localStorage.getItem(DRIVE_VIEW_MODE_STORAGE_KEY);
    return isDriveViewMode(storedMode) ? storedMode : defaultMode;
  } catch {
    return defaultMode;
  }
}

export function useDriveViewMode(defaultMode: DriveViewMode = "list") {
  const [viewMode, setViewModeState] = useState<DriveViewMode>(() =>
    getInitialDriveViewMode(defaultMode),
  );

  const setViewMode = useCallback((mode: DriveViewMode) => {
    setViewModeState(mode);

    try {
      window.localStorage.setItem(DRIVE_VIEW_MODE_STORAGE_KEY, mode);
    } catch {
      // Keep the in-memory preference when storage is unavailable.
    }
  }, []);

  return { viewMode, setViewMode };
}
