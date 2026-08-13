import type { KeyboardEvent, MouseEvent } from "react";

import {
  DeleteOutlined,
  EditOutlined,
  FolderOpenOutlined,
  LinkOutlined,
  MoreOutlined,
  ShareAltOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { Checkbox, Dropdown, Typography, type MenuProps } from "antd";
import { clsx as cn } from "clsx";
import { ThemedSvgIcon } from "@/components/theme/ThemedSvgIcon";
import { formatFileSize, formatModifiedDate } from "@/constants/file-constants";
import type { DriveItem } from "@/types/api.types";
import { getDriveItemIcon } from "@/utils/file-utils";
import classes from "./DriveListView.module.css";
import FileActions from "@/pages/Dashboard/MyDrive/FileActions";
interface DriveListRowProps {
  item: DriveItem;

  selected: boolean;

  selectionMode: boolean;

  contextSelectionCount: number;

  previewOpen: boolean;

  onSelect: (event: MouseEvent<HTMLDivElement>) => void;

  onContextSelect: () => void;

  onToggleSelection: () => void;

  onOpen: () => void;

  onPreviewChange: (open: boolean) => void;

  onPrefetch?: () => void;
}

export function DriveListRow({
  item,
  selected,
  selectionMode,
  contextSelectionCount,
  previewOpen,
  onSelect,
  onContextSelect,
  onToggleSelection,
  onOpen,
  onPreviewChange,
  onPrefetch,
}: DriveListRowProps) {
  const singleTarget = contextSelectionCount === 1;

  const menuItems: MenuProps["items"] = [
    {
      key: "open",
      icon: <FolderOpenOutlined />,
      label: item.type === "folder" ? "Open" : "Preview",
      disabled: !singleTarget,
    },

    {
      type: "divider",
    },

    {
      key: "share",
      icon: <ShareAltOutlined />,
      label: "Share",
      disabled: true,
    },

    ...(singleTarget
      ? [
          {
            key: "copy-link",
            icon: <LinkOutlined />,
            label: "Copy link",
            disabled: true,
          } satisfies NonNullable<MenuProps["items"]>[number],
        ]
      : []),

    {
      key: "move",
      icon: <SwapOutlined />,
      label: "Move",
      disabled: true,
    },

    ...(singleTarget
      ? [
          {
            key: "rename",
            icon: <EditOutlined />,
            label: "Rename",
            disabled: true,
          } satisfies NonNullable<MenuProps["items"]>[number],
        ]
      : []),

    {
      type: "divider",
    },

    {
      key: "trash",
      icon: <DeleteOutlined />,
      label: "Move to Trash",
      danger: true,
      disabled: true,
    },

    {
      key: "more",
      icon: <MoreOutlined />,
      label: "More actions",
      disabled: true,
    },
  ];

  const handleMenuClick: MenuProps["onClick"] = ({ key, domEvent }) => {
    domEvent.stopPropagation();

    if (key === "open") {
      onOpen();
    }
  };

  const handleDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    onOpen();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    onOpen();
  };

  return (
    <Dropdown
      trigger={["contextMenu"]}
      menu={{
        items: menuItems,
        onClick: handleMenuClick,
      }}
      classNames={{
        root: classes.contextMenu,
      }}
    >
      <div
        role="row"
        tabIndex={0}
        aria-selected={selected}
        className={cn(classes.row, selected && classes.selectedRow)}
        onClick={onSelect}
        onDoubleClick={handleDoubleClick}
        onContextMenu={() => {
          onContextSelect();
        }}
        onKeyDown={handleKeyDown}
        onPointerEnter={onPrefetch}
        onFocus={onPrefetch}
      >
        <div role="cell" className={classes.selectionCell}>
          {selectionMode && (
            <Checkbox
              checked={selected}
              aria-label={`Select ${item.name}`}
              onClick={(event) => {
                event.stopPropagation();
              }}
              onChange={() => {
                onToggleSelection();
              }}
            />
          )}
        </div>

        <div role="cell" className={classes.nameCell}>
          <ThemedSvgIcon src={getDriveItemIcon(item)} size={20} className={classes.icon} />

          <Typography.Text
            ellipsis={{
              tooltip: item.name,
            }}
            className={classes.fileName}
          >
            {item.name}
          </Typography.Text>
        </div>

        <div role="cell" className={classes.metadata}>
          {formatModifiedDate(item.updatedAt)}
        </div>

        <div role="cell" className={classes.metadata}>
          {item.type === "folder" ? "—" : formatFileSize(Number(item.sizeBytes ?? 0))}
        </div>

        <div
          role="cell"
          className={classes.actionsCell}
          onClick={(event) => {
            event.stopPropagation();
          }}
          onDoubleClick={(event) => {
            event.stopPropagation();
          }}
          onContextMenu={(event) => {
            event.stopPropagation();
          }}
        >
          <div className={cn(classes.actions, previewOpen && classes.actionsVisible)}>
            <FileActions item={item} isPreview={previewOpen} onPreviewChange={onPreviewChange} onOpenItem={onOpen} />
          </div>
        </div>
      </div>
    </Dropdown>
  );
}
