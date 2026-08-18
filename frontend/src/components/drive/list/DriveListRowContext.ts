import { createContext } from "react";

import type { DriveItem } from "@/types/api.types";

export interface DriveListRowContextValue {
  itemById: ReadonlyMap<string, DriveItem>;
  selectionMode: boolean;
  selectedCount: number;
  isSelected: (itemId: string) => boolean;
  onOpen: (item: DriveItem) => void;
}

export const DriveListRowContext = createContext<DriveListRowContextValue | null>(null);
