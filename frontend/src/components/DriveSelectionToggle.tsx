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
  const { selectionMode, selectedCount, enableSelectionMode, disableSelectionMode } = useDriveSelection();

  const handleClick = () => {
    if (selectionMode) {
      disableSelectionMode();
      return;
    }

    enableSelectionMode();
  };

  const label = selectionMode ? "Done" : "Select";

  return (
    <Button
      type="text"
      size="small"
      shape={showLabel ? "default" : "circle"}
      disabled={selectedCount === 0}
      className={cn(
        classes.toggle,
        showLabel ? classes.withLabel : classes.iconOnly,
        selectionMode && classes.active,
        className
      )}
      aria-label={selectionMode ? "Disable selection mode" : "Enable selection mode"}
      aria-pressed={selectionMode}
      onClick={handleClick}
      icon={selectionMode ? <CloseOutlined /> : <CheckSquareOutlined />}
    >
      {showLabel && <span className={classes.label}>{label}</span>}
    </Button>
  );
}
