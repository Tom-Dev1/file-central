import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

import EmptyState from "./EmptyState";
import FileActions from "./FileActions";
import { useDriveSelection } from "@/contexts/driveSelectionContext";
import type { DriveItem } from "@/types/api.types";
import { getDriveItemIcon } from "@/utils/file-utils";
import { ThemedSvgIcon } from "@/components/theme/ThemedSvgIcon";

interface DriveGridViewProps {
  items: DriveItem[];
  onOpenItem?: (item: DriveItem) => void;
  onPrefetchItem?: (item: DriveItem) => void;
}

export default function DriveGridView({ items, onOpenItem, onPrefetchItem }: DriveGridViewProps) {
  const { selectionMode, isSelected, toggleItem } = useDriveSelection();

  if (items.length === 0) {
    return <EmptyState />;
  }

  const handleItemClick = (item: DriveItem) => {
    if (selectionMode) {
      toggleItem(item.id);
      return;
    }

    onOpenItem?.(item);
  };

  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {items.map((item) => {
        const iconSource = getDriveItemIcon(item);

        const selected = isSelected(item.id);

        return (
          <Card
            key={item.id}
            role="button"
            tabIndex={0}
            aria-selected={selected}
            className={cn(
              "group cursor-pointer overflow-hidden rounded-xl transition-colors",
              "hover:bg-muted/40",
              selected && "border-primary bg-primary/5 ring-1 ring-primary"
            )}
            onClick={() => handleItemClick(item)}
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
            <CardContent className="p-4">
              <div className="flex h-8 items-center justify-between">
                <div className="flex size-8 items-center justify-center">
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

                <div
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <FileActions item={item} />
                </div>
              </div>

              <div className="my-6 flex justify-center">
                <div className="flex size-20 items-center justify-center rounded-2xl bg-muted/50">
                  <ThemedSvgIcon
                    src={iconSource}
                    aria-hidden="true"
                    className="size-12 bg-muted-foreground group-hover:bg-primary"
                  />
                </div>
              </div>

              <div className="flex min-w-0 items-center gap-2">
                <ThemedSvgIcon src={iconSource} className="size-5 bg-muted-foreground group-hover:bg-primary" />

                <p className="truncate text-sm font-medium" title={item.name}>
                  {item.name}
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatModifiedDate(item.updatedAt)}</span>

                <span>{item.type === "folder" ? "Folder" : formatFileSize(item.size)}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function formatModifiedDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatFileSize(bytes?: number): string {
  if (bytes === undefined) {
    return "—";
  }

  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];

  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);

  const value = bytes / 1024 ** unitIndex;

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
