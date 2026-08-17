import { Card, Checkbox, Typography } from "antd";
import { useState } from "react";

import { ThemedSvgIcon } from "@/components/theme/ThemedSvgIcon";
import { formatFileSize, formatModifiedDate } from "@/constants/file-constants";
import { useDriveSelection } from "@/contexts/driveSelectionContext";
import { clsx as cn } from "clsx";
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

  return (
    <div
      className={classes.responsiveGrid}
      onClick={(event) => {
        if (event.target === event.currentTarget) clearSelection();
      }}
    >
      {items.map((item) => {
        const iconSource = getDriveItemIcon(item);
        const selected = isSelected(item.id);
        const isPreviewOpen = previewItemId === item.id;

        return (
          <Card
            key={item.id}
            hoverable
            role="button"
            tabIndex={0}
            aria-selected={selected}
            className={cn(
              classes.card,
              selected && classes.card2
            )}
            styles={{ body: { padding: 16 } }}
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
            <div className={classes.spreadRow}>
              <div className={classes.centeredRow}>
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

            <div className={classes.centeredRow2}>
              <div className={classes.centeredRow3}>
                <ThemedSvgIcon
                  src={iconSource}
                  aria-hidden="true"
                  className={classes.icon}
                />
              </div>
            </div>

            <div className={classes.row}>
              <ThemedSvgIcon
                src={iconSource}
                aria-hidden="true"
                className={classes.icon2}
              />
              <Typography.Text strong ellipsis={{ tooltip: item.name }} className={classes.text}>
                {item.name}
              </Typography.Text>
            </div>

            <div className={classes.spreadRow2}>
              <Typography.Text type="secondary" className={classes.truncatedText}>
                {formatModifiedDate(item.updatedAt)}
              </Typography.Text>
              <Typography.Text type="secondary" className={classes.text2}>
                {item.type === "folder" ? "Folder" : formatFileSize(Number(item.sizeBytes ?? 0))}
              </Typography.Text>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
