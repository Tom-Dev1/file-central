import { useState, type ReactNode } from "react";

import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CheckSquareOutlined,
  CloseOutlined,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  LinkOutlined,
  MoreOutlined,
  ReloadOutlined,
  ShareAltOutlined,
  SortAscendingOutlined,
  SwapOutlined,
} from "@ant-design/icons";

import { App, Button, Dropdown, Flex, Tooltip, Typography, type MenuProps } from "antd";

import { DriveSelectAll } from "@/components/drive/selection/DriveSelectAll";
import { MoveItemsModal } from "@/components/drive/actions/MoveItemsModal";

import type { DriveItem } from "@/types/api.types";
import type { DriveSortField, DriveSortState } from "@/types/drive.type";

import classes from "./DriveToolBar.module.css";
import PopoverUpload from "@/components/PopoverUpload";
import { useDriveSelection } from "@/contexts/driveSelectionContext";
import { useDeleteItems } from "@/hooks";
import { MODIFIED_FILTER_ITEMS, SORT_ITEMS, SORT_LABELS, TYPE_FILTER_ITEMS } from "./toolbar-constant";

interface DriveToolbarProps {
  parentId?: string | null;
  items: DriveItem[];
  sort: DriveSortState;
  sortDisabled?: boolean;
  isFetching?: boolean;
  onSortChange: (sort: DriveSortState) => void;
  onRefresh: () => void;
}

export function DriveToolbar({
  parentId,
  items,
  sort,
  sortDisabled = false,
  isFetching = false,
  onSortChange,
  onRefresh,
}: DriveToolbarProps) {
  const { selectedIds, selectedCount, selectionMode, clearSelection, enableSelectionMode, disableSelectionMode } =
    useDriveSelection();
  const itemIds = items.map((item) => item.id);
  const selectedItems = items.filter((item) => selectedIds.has(item.id));

  if (selectedCount > 0) {
    return (
      <DriveActionToolbar
        itemIds={itemIds}
        selectedItemIds={Array.from(selectedIds)}
        selectedItems={selectedItems}
        selectedCount={selectedCount}
        selectionMode={selectionMode}
        onClear={clearSelection}
        onEnableSelection={enableSelectionMode}
        onDisableSelection={disableSelectionMode}
      />
    );
  }

  return (
    <DriveBrowseToolbar
      parentId={parentId}
      sort={sort}
      sortDisabled={sortDisabled}
      isFetching={isFetching}
      onSortChange={onSortChange}
      onRefresh={onRefresh}
    />
  );
}

interface DriveBrowseToolbarProps {
  parentId?: string | null;
  sort: DriveSortState;
  sortDisabled: boolean;
  isFetching: boolean;
  onSortChange: (sort: DriveSortState) => void;
  onRefresh: () => void;
}

function DriveBrowseToolbar({
  parentId,
  sort,
  sortDisabled,
  isFetching,
  onSortChange,
  onRefresh,
}: DriveBrowseToolbarProps) {
  const handleSortChange: MenuProps["onClick"] = ({ key }) => {
    const field = key as DriveSortField;
    onSortChange({
      field,
      direction:
        sort.field === field && sort.direction === "asc" ? "desc" : "asc",
    });
  };

  return (
    <div className={classes.toolbar}>
      <Flex align="center" gap={8} className={classes.toolbarLeft}>
        <ToolbarDropdown label="Type" items={TYPE_FILTER_ITEMS} disabled />

        <ToolbarDropdown label="Modified" items={MODIFIED_FILTER_ITEMS} disabled />

        <Dropdown
          trigger={["click"]}
          placement="bottomLeft"
          menu={{
            items: SORT_ITEMS,
            selectedKeys: [sort.field],
            onClick: handleSortChange,
          }}
        >
          <Button
            variant="outlined"
            icon={<SortAscendingOutlined />}
            className={classes.toolbarButton}
            disabled={sortDisabled}
          >
            <span>{SORT_LABELS[sort.field]}</span>
            {sort.direction === "asc" ? (
              <ArrowUpOutlined className={classes.directionIcon} />
            ) : (
              <ArrowDownOutlined className={classes.directionIcon} />
            )}
            <DownOutlined className={classes.dropdownIcon} />
          </Button>
        </Dropdown>
      </Flex>

      <Flex align="center" gap={4} className={classes.toolbarRight}>
        <PopoverUpload parentId={parentId} compact />

        <Tooltip title="Refresh files">
          <Button
            variant="text"
            shape="circle"
            aria-label="Refresh files"
            loading={isFetching}
            icon={<ReloadOutlined />}
            className={classes.iconButton}
            onClick={onRefresh}
          />
        </Tooltip>
      </Flex>
    </div>
  );
}
////DriveActionToolbar
interface DriveActionToolbarProps {
  itemIds: string[];
  selectedItemIds: string[];
  selectedItems: DriveItem[];
  selectedCount: number;
  selectionMode: boolean;
  onClear: () => void;
  onEnableSelection: () => void;
  onDisableSelection: () => void;
}

function DriveActionToolbar({
  itemIds,
  selectedItemIds,
  selectedItems,
  selectedCount,
  selectionMode,
  onClear,
  onEnableSelection,
  onDisableSelection,
}: DriveActionToolbarProps) {
  const singleSelection = selectedCount === 1;
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const deleteItems = useDeleteItems();
  const { message, modal } = App.useApp();

  const handleTrash = () => {
    const itemLabel = selectedCount === 1 ? "item" : `${selectedCount} items`;

    modal.confirm({
      title: `Move ${itemLabel} to trash?`,
      content: "Selected folders and everything inside them will be moved to trash.",
      okText: "Move to trash",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      onOk: async () => {
        try {
          await deleteItems.mutateAsync({ itemIds: selectedItemIds });
          onClear();
          void message.success(`${selectedCount} ${selectedCount === 1 ? "item" : "items"} moved to trash`);
        } catch (error) {
          void message.error(error instanceof Error ? error.message : "Unable to move selected items to trash.");
          throw error;
        }
      },
    });
  };

  return (
    <>
      <div className={classes.toolbar}>
        <Flex align="center" gap={4} className={classes.toolbarLeft}>
          <ToolbarAction label="Share" icon={<ShareAltOutlined />} />

          {singleSelection && <ToolbarAction label="Copy link" icon={<LinkOutlined />} />}

          <ToolbarAction
            label="Move"
            icon={<SwapOutlined />}
            disabled={selectedItems.length !== selectedCount}
            onClick={() => setMoveModalOpen(true)}
          />

          {singleSelection && <ToolbarAction label="Rename" icon={<EditOutlined />} />}

          <ToolbarAction
            label="Move to Trash"
            icon={<DeleteOutlined />}
            danger
            loading={deleteItems.isPending}
            onClick={handleTrash}
          />

          <ToolbarAction label="More actions" icon={<MoreOutlined />} />
        </Flex>

        <Flex align="center" gap={8} className={classes.toolbarRight}>
          <Tooltip title="Clear selection">
            <Button
              variant="text"
              shape="circle"
              aria-label="Clear selection"
              icon={<CloseOutlined />}
              className={classes.iconButton}
              onClick={onClear}
            />
          </Tooltip>

          <Typography.Text className={classes.selectionCount}>
            {selectedCount} {selectedCount === 1 ? "item selected" : "items selected"}
          </Typography.Text>

          <Button
            variant={selectionMode ? "filled" : "outlined"}
            icon={<CheckSquareOutlined />}
            className={classes.selectButton}
            onClick={selectionMode ? onDisableSelection : onEnableSelection}
          >
            {selectionMode ? "Done" : "Select"}
          </Button>

          {selectionMode && <DriveSelectAll itemIds={itemIds} showLabel />}
        </Flex>
      </div>

      {moveModalOpen && (
        <MoveItemsModal
          open
          items={selectedItems}
          onClose={() => setMoveModalOpen(false)}
          onMoved={onClear}
        />
      )}
    </>
  );
}

interface ToolbarDropdownProps {
  label: string;
  items: MenuProps["items"];
  disabled?: boolean;
}

function ToolbarDropdown({ label, items, disabled = false }: ToolbarDropdownProps) {
  return (
    <Dropdown trigger={["click"]} placement="bottomLeft" menu={{ items }} disabled={disabled}>
      <Button variant="outlined" className={classes.toolbarButton} disabled={disabled}>
        {label}

        <DownOutlined className={classes.dropdownIcon} />
      </Button>
    </Dropdown>
  );
}

interface ToolbarActionProps {
  label: string;
  icon: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
}

function ToolbarAction({
  label,
  icon,
  danger = false,
  disabled = false,
  loading = false,
  onClick,
}: ToolbarActionProps) {
  return (
    <Tooltip title={label}>
      <Button
        color={danger ? "danger" : "default"}
        variant="text"
        shape="circle"
        aria-label={label}
        icon={icon}
        disabled={disabled || !onClick}
        loading={loading}
        className={classes.iconButton}
        onClick={onClick}
      />
    </Tooltip>
  );
}
