import { useCallback, useMemo, useReducer, type ReactNode } from "react";
import { DriveSelectionContext, type DriveSelectionContextValue } from "./driveSelectionContext";

type DriveSelectionAction =
  | {
      type: "SELECT_ONLY";
      itemId: string;
    }
  | {
      type: "TOGGLE_ITEM";
      itemId: string;
    }
  | {
      type: "SELECT_ALL";
      itemIds: string[];
    }
  | {
      type: "UNSELECT_ITEMS";
      itemIds: string[];
    }
  | {
      type: "CLEAR_SELECTION";
    }
  | {
      type: "ENABLE_SELECTION_MODE";
    }
  | {
      type: "DISABLE_SELECTION_MODE";
    };
interface DriveSelectionState {
  selectedIds: Set<string>;
  selectionMode: boolean;
}
const initialState: DriveSelectionState = {
  selectedIds: new Set(),
  selectionMode: false,
};

function driveSelectionReducer(state: DriveSelectionState, action: DriveSelectionAction): DriveSelectionState {
  switch (action.type) {
    case "SELECT_ONLY": {
      return {
        selectedIds: new Set([action.itemId]),
        selectionMode: false,
      };
    }

    case "TOGGLE_ITEM": {
      const selectedIds = new Set(state.selectedIds);

      if (selectedIds.has(action.itemId)) {
        selectedIds.delete(action.itemId);
      } else {
        selectedIds.add(action.itemId);
      }

      return {
        selectedIds,
        selectionMode: selectedIds.size > 0 ? state.selectionMode : false,
      };
    }

    case "SELECT_ALL": {
      if (action.itemIds.length === 0) {
        return state;
      }

      const selectedIds = new Set(state.selectedIds);

      for (const itemId of action.itemIds) {
        selectedIds.add(itemId);
      }

      return {
        ...state,
        selectedIds,
      };
    }

    case "UNSELECT_ITEMS": {
      if (action.itemIds.length === 0) {
        return state;
      }

      const selectedIds = new Set(state.selectedIds);

      for (const itemId of action.itemIds) {
        selectedIds.delete(itemId);
      }

      return {
        selectedIds,
        selectionMode: selectedIds.size > 0 ? state.selectionMode : false,
      };
    }

    case "CLEAR_SELECTION": {
      return initialState;
    }

    case "ENABLE_SELECTION_MODE": {
      if (state.selectedIds.size === 0) {
        return state;
      }

      return {
        ...state,
        selectionMode: true,
      };
    }

    case "DISABLE_SELECTION_MODE": {
      return {
        ...state,
        selectionMode: false,
      };
    }

    default: {
      return state;
    }
  }
}

interface DriveSelectionProviderProps {
  children: ReactNode;
}

export function DriveSelectionProvider({ children }: DriveSelectionProviderProps) {
  const [state, dispatch] = useReducer(driveSelectionReducer, initialState);

  const selectedCount = state.selectedIds.size;

  const isSelected = useCallback((itemId: string) => state.selectedIds.has(itemId), [state.selectedIds]);

  const selectOnly = useCallback((itemId: string) => {
    dispatch({
      type: "SELECT_ONLY",
      itemId,
    });
  }, []);

  const toggleItem = useCallback((itemId: string) => {
    dispatch({
      type: "TOGGLE_ITEM",
      itemId,
    });
  }, []);

  const selectAll = useCallback((itemIds: string[]) => {
    dispatch({
      type: "SELECT_ALL",
      itemIds,
    });
  }, []);

  const unselectItems = useCallback((itemIds: string[]) => {
    dispatch({
      type: "UNSELECT_ITEMS",
      itemIds,
    });
  }, []);

  const clearSelection = useCallback(() => {
    dispatch({
      type: "CLEAR_SELECTION",
    });
  }, []);

  const enableSelectionMode = useCallback(() => {
    dispatch({
      type: "ENABLE_SELECTION_MODE",
    });
  }, []);

  const disableSelectionMode = useCallback(() => {
    dispatch({
      type: "DISABLE_SELECTION_MODE",
    });
  }, []);

  const value = useMemo<DriveSelectionContextValue>(
    () => ({
      selectedIds: state.selectedIds,

      selectedCount,

      selectionMode: state.selectionMode,

      isSelected,

      selectOnly,
      toggleItem,

      selectAll,
      unselectItems,

      clearSelection,

      enableSelectionMode,
      disableSelectionMode,
    }),
    [
      state.selectedIds,
      state.selectionMode,
      selectedCount,
      isSelected,
      selectOnly,
      toggleItem,
      selectAll,
      unselectItems,
      clearSelection,
      enableSelectionMode,
      disableSelectionMode,
    ]
  );

  return <DriveSelectionContext.Provider value={value}>{children}</DriveSelectionContext.Provider>;
}
