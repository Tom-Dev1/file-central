import {
  AppstoreOutlined,
  CheckOutlined,
  DownOutlined,
  ReloadOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { Button, Dropdown, Segmented, Space, Tooltip, type MenuProps } from "antd";
import PopoverUpload from "@/components/PopoverUpload";
import { DriveSelectionToggle } from "../DriveSelectionToggle";
import { DriveSelectAll } from "./selection/DriveSelectAll";
import { useDriveSelection } from "@/contexts/driveSelectionContext";

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
  const { selectionMode } = useDriveSelection();
  const sortItems: MenuProps["items"] = [
    { key: "name", label: "Name" },
    { key: "modified", label: "Last modified", icon: <CheckOutlined /> },
    { key: "opened", label: "Last opened" },
    { key: "size", label: "File size" },
  ];

  return (
    <Space size={8} wrap>
      <PopoverUpload parentId={parentId} className="h-9 rounded-xl" />

      <Dropdown menu={{ items: sortItems }} trigger={["click"]} placement="bottomRight">
        <Button className="h-9" icon={<DownOutlined />} iconPosition="end">
          Last modified
        </Button>
      </Dropdown>

      <Space.Compact className="rounded-xl border border-border bg-background p-0.5">
        {selectionMode && <DriveSelectAll itemIds={itemIds} showLabel={false} className="px-1" />}

        <DriveSelectionToggle />
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
