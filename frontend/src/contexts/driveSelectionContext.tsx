import { createContext, useContext } from "react";

export interface DriveSelectionContextValue {
  selectedIds: Set<string>;
  selectedCount: number;
  selectionMode: boolean;

  isSelected: (itemId: string) => boolean;

  selectOnly: (itemId: string) => void;

  toggleItem: (itemId: string) => void;

  selectAll: (itemIds: string[]) => void;

  unselectItems: (itemIds: string[]) => void;

  clearSelection: () => void;

  enableSelectionMode: () => void;

  disableSelectionMode: () => void;
}

export const DriveSelectionContext = createContext<DriveSelectionContextValue | null>(null);

export function useDriveSelection() {
  const context = useContext(DriveSelectionContext);

  if (!context) {
    throw new Error("useDriveSelection must be used within DriveSelectionProvider.");
  }

  return context;
}
