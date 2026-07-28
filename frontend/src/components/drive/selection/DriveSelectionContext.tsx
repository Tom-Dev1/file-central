import { DriveSelectionContext } from "@/contexts/driveSelectionContext";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

interface DriveSelectionState {
  selectionMode: boolean;
  selectedIds: Set<string>;
}
interface DriveSelectionContextValue {
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

interface DriveSelectionProviderProps {
  children: ReactNode;
}

const initialState: DriveSelectionState = {
  selectionMode: false,
  selectedIds: new Set<string>(),
};

export function DriveSelectionProvider({ children }: DriveSelectionProviderProps) {
  const location = useLocation();

  const [state, setState] = useState<DriveSelectionState>(initialState);

  // Clear the selection when navigating to another folder or Drive page.
  useEffect(() => {
    setState({
      selectionMode: false,
      selectedIds: new Set<string>(),
    });
  }, [location.pathname]);

  const toggleSelectionMode = useCallback(() => {
    setState((current) => {
      if (current.selectionMode) {
        return {
          selectionMode: false,
          selectedIds: new Set<string>(),
        };
      }

      return {
        ...current,
        selectionMode: true,
      };
    });
  }, []);

  const enableSelectionMode = useCallback(() => {
    setState((current) => ({
      ...current,
      selectionMode: true,
    }));
  }, []);

  const disableSelectionMode = useCallback(() => {
    setState({
      selectionMode: false,
      selectedIds: new Set<string>(),
    });
  }, []);

  const toggleItem = useCallback((itemId: string) => {
    setState((current) => {
      const nextSelectedIds = new Set(current.selectedIds);

      if (nextSelectedIds.has(itemId)) {
        nextSelectedIds.delete(itemId);
      } else {
        nextSelectedIds.add(itemId);
      }

      return {
        ...current,
        selectionMode: true,
        selectedIds: nextSelectedIds,
      };
    });
  }, []);

  const selectItem = useCallback((itemId: string) => {
    setState((current) => {
      const nextSelectedIds = new Set(current.selectedIds);

      nextSelectedIds.add(itemId);

      return {
        selectionMode: true,
        selectedIds: nextSelectedIds,
      };
    });
  }, []);

  const unselectItem = useCallback((itemId: string) => {
    setState((current) => {
      const nextSelectedIds = new Set(current.selectedIds);

      nextSelectedIds.delete(itemId);

      return {
        ...current,
        selectedIds: nextSelectedIds,
      };
    });
  }, []);

  const unselectItems = useCallback((itemIds: string[]) => {
    setState((current) => {
      const nextSelectedIds = new Set(current.selectedIds);

      itemIds.forEach((itemId) => {
        nextSelectedIds.delete(itemId);
      });

      return {
        ...current,
        selectedIds: nextSelectedIds,
      };
    });
  }, []);

  const selectAll = useCallback((itemIds: string[]) => {
    setState({
      selectionMode: true,
      selectedIds: new Set(itemIds),
    });
  }, []);

  const clearSelection = useCallback(() => {
    setState((current) => ({
      ...current,
      selectedIds: new Set<string>(),
    }));
  }, []);

  const isSelected = useCallback((itemId: string) => state.selectedIds.has(itemId), [state.selectedIds]);

  const value = useMemo<DriveSelectionContextValue>(
    () => ({
      selectionMode: state.selectionMode,
      selectedIds: state.selectedIds,
      selectedCount: state.selectedIds.size,

      isSelected,
      toggleSelectionMode,
      enableSelectionMode,
      disableSelectionMode,
      toggleItem,
      selectItem,
      unselectItem,
      selectAll,
      unselectItems,
      clearSelection,
    }),
    [
      state.selectionMode,
      state.selectedIds,
      isSelected,
      toggleSelectionMode,
      enableSelectionMode,
      disableSelectionMode,
      toggleItem,
      selectItem,
      unselectItem,
      selectAll,
      unselectItems,
      clearSelection,
    ]
  );

  return <DriveSelectionContext.Provider value={value}>{children}</DriveSelectionContext.Provider>;
}
