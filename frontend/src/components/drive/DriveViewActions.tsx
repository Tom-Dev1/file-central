import {
  AppstoreOutlined,
  DeleteOutlined,
  ReloadOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { App, Button, Segmented, Space, Tooltip, Typography } from "antd";
import PopoverUpload from "@/components/PopoverUpload";
import { DriveSelectionToggle } from "../DriveSelectionToggle";
import { DriveSelectAll } from "./selection/DriveSelectAll";
import { useDriveSelection } from "@/contexts/driveSelectionContext";
import { useDeleteItem } from "@/hooks";

export type ViewMode = "grid" | "list";

interface DriveViewActionsProps {
  parentId?: string | null;
  itemIds: string[];
  viewMode: ViewMode;
  isFetching?: boolean;
  onViewModeChange: (mode: ViewMode) => void;
  onRefresh: () => void;
}

export function DriveViewActions({
  parentId,
  viewMode,
  isFetching = false,
  onViewModeChange,
  onRefresh,
  itemIds,
}: DriveViewActionsProps) {
  const { selectionMode, selectedIds, selectedCount, disableSelectionMode, unselectItems } = useDriveSelection();
  const deleteItem = useDeleteItem();
  const { message, modal } = App.useApp();

  const confirmDeleteSelected = () => {
    if (selectedCount === 0 || deleteItem.isPending) return;

    const ids = [...selectedIds];
    modal.confirm({
      title: `Move ${ids.length} selected ${ids.length === 1 ? "item" : "items"} to Trash?`,
      content: "You can restore them later from Trash.",
      okText: "Move to Trash",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      onOk: async () => {
        try {
          for (const id of ids) {
            await deleteItem.mutateAsync(id);
            unselectItems([id]);
          }
          disableSelectionMode();
          void message.success(`${ids.length} ${ids.length === 1 ? "item" : "items"} moved to Trash`);
        } catch (error) {
          void message.error(error instanceof Error ? error.message : "Unable to move every selected item to Trash.");
          throw error;
        }
      },
    });
  };

  return (
    <Space size={8} wrap>
      <PopoverUpload parentId={parentId} className="h-9 rounded-xl" />

      {selectionMode && (
        <Space size={6}>
          <Typography.Text type="secondary" className="whitespace-nowrap !text-xs">
            {selectedCount} selected
          </Typography.Text>
          <Tooltip title={selectedCount === 0 ? "Select items first" : "Move selected items to Trash"}>
            <Button
              danger
              size="small"
              icon={<DeleteOutlined />}
              disabled={selectedCount === 0}
              loading={deleteItem.isPending}
              onClick={confirmDeleteSelected}
            >
              Trash
            </Button>
          </Tooltip>
        </Space>
      )}

      <Space.Compact className="rounded-xl border border-border bg-background p-0.5">
        {selectionMode && <DriveSelectAll itemIds={itemIds} showLabel={false} className="px-1" />}

        <DriveSelectionToggle showLabel />
        <Tooltip title="Refresh files">
          <Button
            type="text"
            size="small"
            shape="circle"
            loading={isFetching}
            aria-label="Refresh files"
            icon={<ReloadOutlined />}
            onClick={onRefresh}
          />
        </Tooltip>

        <Segmented
          size="small"
          value={viewMode}
          aria-label="Choose file view"
          options={[
            { value: "list", icon: <UnorderedListOutlined />, label: <span className="sr-only">List view</span> },
            { value: "grid", icon: <AppstoreOutlined />, label: <span className="sr-only">Grid view</span> },
          ]}
          onChange={(value) => onViewModeChange(value as ViewMode)}
        />
      </Space.Compact>
    </Space>
  );
}
