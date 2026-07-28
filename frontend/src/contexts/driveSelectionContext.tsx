import type { DriveSelectionContextValue } from "@/components/drive/selection/DriveSelectionContext";
import { createContext, useContext } from "react";

export const DriveSelectionContext = createContext<DriveSelectionContextValue | null>(null);

export function useDriveSelection() {
  const context = useContext(DriveSelectionContext);

  if (!context) {
    throw new Error("useDriveSelection must be used within DriveSelectionProvider.");
  }

  return context;
}
