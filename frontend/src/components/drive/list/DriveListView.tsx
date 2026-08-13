import { useState, type MouseEvent } from "react";

import { useDriveSelection } from "@/contexts/driveSelectionContext";

import type { DriveItem } from "@/types/api.types";
import type { DriveSortState } from "@/types/drive.type";

import EmptyFolderState from "@/components/EmptyFolderState";

import { DriveListHeader } from "./DriveListHeader";
import { DriveListRow } from "./DriveListRow";

import classes from "./DriveListView.module.css";

interface DriveListViewProps {
  items: DriveItem[];

  sort: DriveSortState;

  onSortChange: (sort: DriveSortState) => void;

  onOpenItem?: (item: DriveItem) => void;

  onPrefetchItem?: (item: DriveItem) => void;
}

export function DriveListView({ items, sort, onSortChange, onOpenItem, onPrefetchItem }: DriveListViewProps) {
  const { selectionMode, selectedCount, isSelected, selectOnly, toggleItem, clearSelection } = useDriveSelection();

  const [previewItemId, setPreviewItemId] = useState<string | null>(null);

  const handleRowClick = (event: MouseEvent<HTMLDivElement>, item: DriveItem) => {
    /*
     * The second click of a double-click
     * must not trigger another selection action.
     */
    if (event.detail > 1) {
      return;
    }

    if (selectionMode) {
      toggleItem(item.id);
      return;
    }

    selectOnly(item.id);
  };

  const handleContextSelect = (item: DriveItem) => {
    if (isSelected(item.id)) {
      return;
    }

    if (selectionMode) {
      toggleItem(item.id);
      return;
    }

    selectOnly(item.id);
  };

  const handleOpenItem = (item: DriveItem) => {
    if (item.type === "folder") {
      clearSelection();

      onOpenItem?.(item);

      return;
    }

    selectOnly(item.id);

    setPreviewItemId(item.id);
  };

  if (items.length === 0) {
    return <EmptyFolderState />;
  }

  return (
    <div role="table" aria-label="Drive files" className={classes.list}>
      <DriveListHeader sort={sort} onSortChange={onSortChange} />

      <div
        role="rowgroup"
        className={classes.body}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            clearSelection();
          }
        }}
      >
        {items.map((item) => {
          const selected = isSelected(item.id);

          const contextSelectionCount = selected ? selectedCount : selectionMode ? selectedCount + 1 : 1;

          return (
            <DriveListRow
              key={item.id}
              item={item}
              selected={selected}
              selectionMode={selectionMode}
              contextSelectionCount={contextSelectionCount}
              previewOpen={previewItemId === item.id}
              onSelect={(event) => handleRowClick(event, item)}
              onContextSelect={() => handleContextSelect(item)}
              onToggleSelection={() => toggleItem(item.id)}
              onOpen={() => handleOpenItem(item)}
              onPreviewChange={(open) => setPreviewItemId(open ? item.id : null)}
              onPrefetch={item.type === "folder" && onPrefetchItem ? () => onPrefetchItem(item) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
