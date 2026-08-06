import { CheckSquareOutlined, CloseOutlined } from "@ant-design/icons";

import { Button } from "antd";
import { cn } from "@/lib/utils";
import { useDriveSelection } from "@/contexts/driveSelectionContext";

interface DriveSelectionToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function DriveSelectionToggle({ className, showLabel = false }: DriveSelectionToggleProps) {
  const { selectionMode, selectedCount, toggleSelectionMode } = useDriveSelection();

  return (
    <Button
      type={selectionMode ? "default" : "text"}
      size="small"
      shape={showLabel ? "default" : "circle"}
      className={cn(showLabel ? "h-8" : "size-8", className)}
      aria-label={selectionMode ? "Disable selection mode" : "Enable selection mode"}
      aria-pressed={selectionMode}
      onClick={toggleSelectionMode}
      icon={selectionMode ? <CloseOutlined /> : <CheckSquareOutlined />}
    >
      {showLabel && (
        <span>
          {selectionMode ? (selectedCount > 0 ? `${selectedCount} selected` : "Cancel selection") : "Select items"}
        </span>
      )}
    </Button>
  );
}
