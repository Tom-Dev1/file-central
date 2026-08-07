import { Checkbox, Table, Typography, type TableColumnsType } from "antd";
import { useState } from "react";

import EmptyFolderState from "@/components/EmptyFolderState";
import { ThemedSvgIcon } from "@/components/theme/ThemedSvgIcon";
import { formatFileSize, formatModifiedDate } from "@/constants/file-constants";
import { useDriveSelection } from "@/contexts/driveSelectionContext";
import { cn } from "@/lib/utils";
import type { DriveItem } from "@/types/api.types";
import { getDriveItemIcon } from "@/utils/file-utils";

import FileActions from "./FileActions";

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

  const columns: TableColumnsType<DriveItem> = [
    {
      key: "selection",
      width: selectionMode ? 48 : 12,
      render: (_, item) =>
        selectionMode ? (
          <Checkbox
            checked={isSelected(item.id)}
            aria-label={`Select ${item.name}`}
            onClick={(event) => event.stopPropagation()}
            onChange={() => toggleItem(item.id)}
          />
        ) : null,
    },
    {
      key: "name",
      title: "Name",
      render: (_, item) => {
        const iconSource = getDriveItemIcon(item);
        const mobileSize = item.type === "folder" ? "Folder" : formatFileSize(Number(item.sizeBytes ?? 0));

        return (
          <div className="flex min-w-0 items-center gap-3">
            <ThemedSvgIcon
              src={iconSource}
              aria-hidden="true"
              className="size-5 shrink-0 bg-muted-foreground transition-colors group-hover:bg-primary"
            />
            <div className="min-w-0">
              <Typography.Text strong ellipsis={{ tooltip: item.name }} className="block">
                {item.name}
              </Typography.Text>
              <Typography.Text type="secondary" className="block truncate text-xs md:hidden">
                {formatModifiedDate(item.updatedAt)} · {mobileSize}
              </Typography.Text>
            </div>
          </div>
        );
      },
    },
    {
      key: "modified",
      title: "Last modified",
      width: 170,
      responsive: ["md"],
      render: (_, item) => <Typography.Text type="secondary">{formatModifiedDate(item.updatedAt)}</Typography.Text>,
    },
    {
      key: "size",
      title: "File size",
      width: 120,
      responsive: ["sm"],
      render: (_, item) => (
        <Typography.Text type="secondary">
          {item.type === "folder" ? "—" : formatFileSize(Number(item.sizeBytes ?? 0))}
        </Typography.Text>
      ),
    },
    {
      key: "actions",
      title: <span className="sr-only">Actions</span>,
      align: "right",
      width: 56,
      render: (_, item) => {
        const isPreviewOpen = previewItemId === item.id;

        return (
          <div
            className={cn(
              "flex justify-end transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100",
              isPreviewOpen && "opacity-100"
            )}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <FileActions
              item={item}
              isPreview={isPreviewOpen}
              onPreviewChange={(open) => setPreviewItemId(open ? item.id : null)}
              onOpenItem={() => onOpenItem?.(item)}
            />
          </div>
        );
      },
    },
  ];

  if (items.length === 0) {
    return <EmptyFolderState />;
  }

  return (
    <Table<DriveItem>
      rowKey="id"
      columns={columns}
      dataSource={items}
      pagination={false}
      tableLayout="fixed"
      size="middle"
      className="overflow-hidden rounded-xl"
      rowClassName={(item) => cn("group cursor-pointer", isSelected(item.id) && "ant-table-row-selected")}
      onRow={(item) => ({
        tabIndex: 0,
        "aria-selected": isSelected(item.id),
        onClick: () => handleItemClick(item),
        onKeyDown: (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleItemClick(item);
          }
        },
        onPointerEnter: () => onPrefetchItem?.(item),
        onFocus: () => onPrefetchItem?.(item),
      })}
    />
  );
}
