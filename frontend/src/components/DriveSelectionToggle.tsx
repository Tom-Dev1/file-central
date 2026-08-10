import { CheckSquareOutlined, CloseOutlined } from "@ant-design/icons";

import { Button } from "antd";
import { clsx as cn } from "clsx";
import { useDriveSelection } from "@/contexts/driveSelectionContext";
import classes from "./DriveSelectionToggle.module.css";


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
      className={cn(showLabel ? classes.button : classes.button2, className)}
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
