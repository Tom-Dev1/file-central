import { Card, Checkbox, Typography } from "antd";
import { clsx as cn } from "clsx";
import { type MouseEvent, useState } from "react";

import { ThemedSvgIcon } from "@/components/theme/ThemedSvgIcon";
import { formatDriveFileSize, formatModifiedDate } from "@/constants/file-constants";
import { useDriveSelection } from "@/contexts/driveSelectionContext";
import type { DriveItem } from "@/types/api.types";
import { getDriveItemIcon } from "@/utils/file-utils";

import EmptyState from "./EmptyState";
import FileActions from "./FileActions";
import classes from "./DriveGridView.module.css";

interface DriveGridViewProps {
  items: DriveItem[];
  previewPaneOpen?: boolean;
  onOpenItem?: (item: DriveItem) => void;
  onPrefetchItem?: (item: DriveItem) => void;
}

export default function DriveGridView({
  items,
  previewPaneOpen = false,
  onOpenItem,
  onPrefetchItem,
}: DriveGridViewProps) {
  const { selectionMode, isSelected, selectOnly, toggleItem, clearSelection } = useDriveSelection();
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);

  if (items.length === 0) {
    return <EmptyState />;
  }

  const handleItemClick = (item: DriveItem) => {
    if (selectionMode) {
      toggleItem(item.id);
      return;
    }

    if (previewPaneOpen) {
      selectOnly(item.id);
      return;
    }

    if (item.type === "folder") {
      onOpenItem?.(item);
      return;
    }

    setPreviewItemId(item.id);
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

  const clearSelectionFromBackground = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) clearSelection();
  };

  return (
    <div className={classes.viewport} onClick={clearSelectionFromBackground}>
      <div className={classes.grid} onClick={clearSelectionFromBackground}>
        {items.map((item) => {
          const iconSource = getDriveItemIcon(item);
          const selected = isSelected(item.id);
          const isPreviewOpen = previewItemId === item.id;

          return (
            <Card
              key={item.id}
              variant="outlined"
              hoverable
              role="button"
              tabIndex={0}
              aria-selected={selected}
              classNames={{
                root: cn(classes.card, selected && classes.cardSelected),
                body: classes.cardBody,
              }}
              onClick={() => handleItemClick(item)}
              onDoubleClick={(event) => {
                if (!previewPaneOpen) return;
                event.preventDefault();
                event.stopPropagation();
                handleOpenItem(item);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (previewPaneOpen) {
                    handleOpenItem(item);
                  } else {
                    handleItemClick(item);
                  }
                } else if (event.key === " ") {
                  event.preventDefault();
                  handleItemClick(item);
                }
              }}
              onPointerEnter={() => onPrefetchItem?.(item)}
              onFocus={() => onPrefetchItem?.(item)}
            >
              <div className={classes.cardHeader}>
                <div className={classes.selectionSlot}>
                  {selectionMode && (
                    <Checkbox
                      checked={selected}
                      aria-label={`Select ${item.name}`}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() => toggleItem(item.id)}
                    />
                  )}
                </div>

                <div
                  className={classes.actions}
                  onClick={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <FileActions
                    item={item}
                    isPreview={isPreviewOpen}
                    onPreviewChange={(open) => setPreviewItemId(open ? item.id : null)}
                    onOpenItem={() => onOpenItem?.(item)}
                  />
                </div>
              </div>

              <div className={classes.preview}>
                <div className={classes.previewSurface}>
                  <ThemedSvgIcon
                    src={iconSource}
                    aria-hidden="true"
                    className={classes.previewIcon}
                  />
                </div>
              </div>

              <div className={classes.nameRow}>
                <ThemedSvgIcon
                  src={iconSource}
                  aria-hidden="true"
                  className={classes.nameIcon}
                />
                <Typography.Text strong ellipsis={{ tooltip: item.name }} className={classes.name}>
                  {item.name}
                </Typography.Text>
              </div>

              <div className={classes.metadataRow}>
                <Typography.Text type="secondary" className={classes.metadata}>
                  {formatModifiedDate(item.updatedAt)}
                </Typography.Text>
                <Typography.Text type="secondary" className={classes.metadataValue}>
                  {item.type === "folder" ? "Folder" : formatDriveFileSize(item)}
                </Typography.Text>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
