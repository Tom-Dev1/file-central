import type { DriveItem } from "@/types/api.types";
import FileActions from "./FileActions";
import { getDriveItemIcon } from "@/utils/file-utils";
import { formatFileSize, formatModifiedDate } from "@/constants/file-constants";
import { ThemedSvgIcon } from "@/components/theme/ThemedSvgIcon";
import { useDriveSelection } from "@/contexts/driveSelectionContext";
import EmptyFolderState from "@/components/EmptyFolderState";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";

interface DriveListViewProps {
  items: DriveItem[];
  onOpenItem?: (item: DriveItem) => void;
  onPrefetchItem?: (item: DriveItem) => void;
}

export function DriveListView({ items, onOpenItem, onPrefetchItem }: DriveListViewProps) {
  const { selectionMode, isSelected, toggleItem } = useDriveSelection();

  const [previewItemId, setPreviewItemId] = useState<string | null>(null);

  const handleItemClick = (item: DriveItem) => {
    if (selectionMode) {
      toggleItem(item.id);
      return;
    }
    if (item.type === "folder") {
      onOpenItem?.(item);
      return;
    }

    setPreviewItemId(item.id);
  };

  const handlePreviewChange = (itemId: string, open: boolean) => {
    setPreviewItemId(open ? itemId : null);
  };

  if (items.length === 0) {
    return <EmptyFolderState />;
  }

  return (
    <div className="overflow-hidden rounded-xl bg-background">
      <div className="grid grid-cols-[36px_minmax(0,1fr)_160px_120px_44px] items-center bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
        <span />
        <span>Name</span>
        <span>Last modified</span>
        <span>File size</span>
        <span />
      </div>

      <div>
        {items.map((item) => {
          const selected = isSelected(item.id);

          const iconSource = getDriveItemIcon(item);

          const isItemPreviewOpen = previewItemId === item.id;

          return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              aria-selected={selected}
              className={cn(
                "group grid min-h-12 cursor-pointer grid-cols-[36px_minmax(0,1fr)_160px_120px_44px] items-center border-b px-3 text-sm transition-colors last:border-b-0",
                "hover:bg-muted/50",
                selected && "bg-primary/5"
              )}
              onClick={() => {
                handleItemClick(item);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleItemClick(item);
                }
              }}
              onPointerEnter={() => {
                onPrefetchItem?.(item);
              }}
              onFocus={() => {
                onPrefetchItem?.(item);
              }}
            >
              <div className="mr-2 flex items-center justify-center">
                {selectionMode && (
                  <Checkbox
                    checked={selected}
                    aria-label={`Select ${item.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                    onCheckedChange={() => {
                      toggleItem(item.id);
                    }}
                  />
                )}
              </div>

              <div className="flex min-w-0 items-center gap-3">
                <ThemedSvgIcon src={iconSource} className="size-5 bg-muted-foreground group-hover:bg-primary" />

                <span className="truncate font-medium" title={item.name}>
                  {item.name}
                </span>
              </div>

              <span className="truncate text-xs text-muted-foreground">{formatModifiedDate(item.updatedAt)}</span>

              <span className="text-xs text-muted-foreground">
                {item.type === "folder" ? "â€”" : formatFileSize(Number(item.sizeBytes ?? 0))}
              </span>

              <div
                className={cn(
                  "flex justify-end transition-opacity",
                  "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
                  isItemPreviewOpen && "opacity-100"
                )}
                onClick={(event) => {
                  event.stopPropagation();
                }}
                onKeyDown={(event) => {
                  event.stopPropagation();
                }}
              >
                <FileActions
                  item={item}
                  isPreview={isItemPreviewOpen}
                  onPreviewChange={(open) => {
                    handlePreviewChange(item.id, open);
                  }}
                  onOpenItem={() => {
                    onOpenItem?.(item);
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
