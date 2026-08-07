import {
  DriveSelectionContext,
  type DriveSelectionContextValue,
} from "@/contexts/driveSelectionContext";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

interface DriveSelectionState {
  pathname: string;
  selectionMode: boolean;
  selectedIds: Set<string>;
}
export type { DriveSelectionContextValue } from "@/contexts/driveSelectionContext";

interface DriveSelectionProviderProps {
  children: ReactNode;
}

const createInitialState = (pathname: string): DriveSelectionState => ({
  pathname,
  selectionMode: false,
  selectedIds: new Set<string>(),
});

export function DriveSelectionProvider({ children }: DriveSelectionProviderProps) {
  const location = useLocation();

  const [state, setState] = useState<DriveSelectionState>(() => createInitialState(location.pathname));

  // React supports guarded state adjustment during render; children never observe
  // a selection that belongs to the previous route.
  if (state.pathname !== location.pathname) {
    setState(createInitialState(location.pathname));
  }

  const toggleSelectionMode = useCallback(() => {
    setState((current) => {
      if (current.selectionMode) {
        return {
          pathname: current.pathname,
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
      pathname: location.pathname,
      selectionMode: false,
      selectedIds: new Set<string>(),
    });
  }, [location.pathname]);

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
        pathname: current.pathname,
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
      pathname: location.pathname,
      selectionMode: true,
      selectedIds: new Set(itemIds),
    });
  }, [location.pathname]);

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
