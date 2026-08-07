import { createContext, useContext } from "react";

export interface DriveSelectionContextValue {
  selectionMode: boolean;
  selectedIds: ReadonlySet<string>;
  selectedCount: number;
  isSelected: (itemId: string) => boolean;
  toggleSelectionMode: () => void;
  enableSelectionMode: () => void;
  disableSelectionMode: () => void;
  toggleItem: (itemId: string) => void;
  selectItem: (itemId: string) => void;
  unselectItem: (itemId: string) => void;
  selectAll: (itemIds: string[]) => void;
  unselectItems: (itemIds: string[]) => void;
  clearSelection: () => void;
}

export const DriveSelectionContext = createContext<DriveSelectionContextValue | null>(null);

export function useDriveSelection() {
  const context = useContext(DriveSelectionContext);

  if (!context) {
    throw new Error("useDriveSelection must be used within DriveSelectionProvider.");
  }

  return context;
}
