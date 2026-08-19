import { createContext } from "react";

import type { DriveItemKind } from "@/types/api.types";

export interface DriveListRowItem {
  selectionId: string;
  type: DriveItemKind;
}

export interface DriveListRowContextValue {
  itemByRowKey: ReadonlyMap<string, DriveListRowItem>;
  selectionMode: boolean;
  selectedCount: number;
  isSelected: (itemId: string) => boolean;
  onOpen: (rowKey: string) => void;
}

export const DriveListRowContext = createContext<DriveListRowContextValue | null>(null);
