import {
  CheckSquareOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { Button } from "antd";
import { clsx as cn } from "clsx";

import { useDriveSelection } from "@/contexts/driveSelectionContext";

import classes from "./DriveSelectionToggle.module.css";

interface DriveSelectionToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function DriveSelectionToggle({
  className,
  showLabel = false,
}: DriveSelectionToggleProps) {
  const { selectionMode, selectedCount, toggleSelectionMode, } = useDriveSelection();

  const label = selectionMode
    ? selectedCount > 0
      ? `${selectedCount} selected`
      : "Cancel selection"
    : "Select items";

  return (
    <Button
      type="text"
      size="small"
      shape={showLabel ? "default" : "circle"}
      className={cn(
        classes.toggle,
        showLabel
          ? classes.withLabel
          : classes.iconOnly,
        selectionMode &&
        classes.active,
        className,
      )}
      aria-label={
        selectionMode
          ? "Disable selection mode"
          : "Enable selection mode"
      }
      aria-pressed={selectionMode}
      onClick={toggleSelectionMode}
      icon={
        selectionMode ? (
          <CloseOutlined />
        ) : (
          <CheckSquareOutlined />
        )
      }
    >
      {showLabel && (
        <span className={classes.label}>
          {label}
        </span>
      )}
    </Button>
  );
}