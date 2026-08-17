import { useContext } from "react";

import { UploadManagerContext } from "@/contexts/upload-manager.context";

export function useUploadManager() {
  const context = useContext(UploadManagerContext);

  if (!context) {
    throw new Error("useUploadManager must be used within UploadManagerProvider");
  }

  return context;
}
