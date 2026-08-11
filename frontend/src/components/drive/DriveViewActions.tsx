import {
  AppstoreOutlined,
  DeleteOutlined,
  ReloadOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  Flex,
  Segmented,
  Tooltip,
  Typography,
} from "antd";

import PopoverUpload from "@/components/PopoverUpload";
import { useDriveSelection } from "@/contexts/driveSelectionContext";
import { useDeleteItem } from "@/hooks";

import { DriveSelectionToggle } from "../DriveSelectionToggle";
import { DriveSelectAll } from "./selection/DriveSelectAll";

import classes from "./DriveViewActions.module.css";

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
  const {
    selectionMode,
    selectedIds,
    selectedCount,
    disableSelectionMode,
    unselectItems,
  } = useDriveSelection();

  const deleteItem = useDeleteItem();

  const { message, modal } = App.useApp();

  const confirmDeleteSelected = () => {
    if (
      selectedCount === 0 ||
      deleteItem.isPending
    ) {
      return;
    }

    const ids = [...selectedIds];

    modal.confirm({
      title: `Move ${ids.length} selected ${ids.length === 1
        ? "item"
        : "items"
        } to Trash?`,
      content:
        "You can restore them later from Trash.",
      okText: "Move to Trash",
      okButtonProps: {
        danger: true,
      },
      cancelText: "Cancel",

      onOk: async () => {
        try {
          for (const id of ids) {
            await deleteItem.mutateAsync(
              id,
            );

            unselectItems([id]);
          }

          disableSelectionMode();

          void message.success(
            `${ids.length} ${ids.length === 1
              ? "item"
              : "items"
            } moved to Trash`,
          );
        } catch (error) {
          void message.error(
            error instanceof Error
              ? error.message
              : "Unable to move every selected item to Trash.",
          );

          throw error;
        }
      },
    });
  };
  const hasItems = itemIds.length > 0;

  return (
    <div className={classes.driveViewActions}>
      {hasItems && selectionMode && (
        <Flex
          align="center"
          gap={4}
          className={classes.selectionActions}
        >
          <Typography.Text
            type="secondary"
            className={
              classes.driveViewActionsSelectionText
            }
          >
            {selectedCount} selected
          </Typography.Text>

          <Tooltip
            title={
              selectedCount === 0
                ? "Select items first"
                : "Move selected items to Trash"
            }
          >
            <Button
              color="danger"
              variant="text"
              size="small"
              icon={<DeleteOutlined />}
              disabled={selectedCount === 0}
              loading={deleteItem.isPending}
              onClick={confirmDeleteSelected}
            >
              Trash
            </Button>
          </Tooltip>
        </Flex>
      )}

      <Flex
        align="center"
        gap={4}
        aria-busy={isFetching}
        className={
          classes.driveViewActionsToolbar
        }
      >
        {hasItems && selectionMode && (
          <DriveSelectAll
            itemIds={itemIds}
            showLabel={false}
            className={
              classes.driveViewActionsSelectAll
            }
          />
        )}

        {hasItems && (
          <DriveSelectionToggle showLabel />
        )}

        <PopoverUpload parentId={parentId} />

        <Tooltip title="Refresh files">
          <Button
            variant="text"
            shape="circle"
            size="small"
            loading={isFetching}
            aria-label="Refresh files"
            icon={<ReloadOutlined />}
            onClick={onRefresh}
          />
        </Tooltip>

        <Segmented
          size="small"
          shape="round"
          value={viewMode}
          aria-label="Choose file view"
          classNames={{
            root:
              classes.driveViewActionsViewMode,
            item:
              classes.driveViewActionsViewModeItem,
            label:
              classes.driveViewActionsViewModeLabel,
            icon:
              classes.driveViewActionsViewModeIcon,
          }}
          options={[
            {
              value: "list",
              icon: <UnorderedListOutlined />,
              tooltip: "List view",
            },
            {
              value: "grid",
              icon: <AppstoreOutlined />,
              tooltip: "Grid view",
            },
          ]}
          onChange={(value) =>
            onViewModeChange(value as ViewMode)
          }
        />
      </Flex>
    </div>
  );
}