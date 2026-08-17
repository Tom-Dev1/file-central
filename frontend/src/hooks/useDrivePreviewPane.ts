import { useCallback, useState } from "react";

const PREVIEW_PANE_STORAGE_KEY = "file-central-drive-preview-pane";

function getInitialPreviewPaneState() {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(PREVIEW_PANE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function useDrivePreviewPane() {
  const [previewPaneOpen, setPreviewPaneOpenState] = useState(getInitialPreviewPaneState);

  const setPreviewPaneOpen = useCallback((open: boolean) => {
    setPreviewPaneOpenState(open);

    try {
      window.localStorage.setItem(PREVIEW_PANE_STORAGE_KEY, String(open));
    } catch {
      // Keep the in-memory preference when storage is unavailable.
    }
  }, []);

  return { previewPaneOpen, setPreviewPaneOpen };
}
