import { Checkbox } from "antd";
import { clsx as cn } from "clsx";
import { useId } from "react";

import { useDriveSelection } from "@/contexts/driveSelectionContext";

import classes from "./DriveSelectAll.module.css";

interface DriveSelectAllProps {
  itemIds: string[];
  className?: string;
  showLabel?: boolean;
}

export function DriveSelectAll({
  itemIds,
  className,
  showLabel = true,
}: DriveSelectAllProps) {
  const checkboxId = useId();

  const {
    selectedIds,
    selectAll,
    unselectItems,
  } = useDriveSelection();

  const selectedVisibleCount = itemIds.reduce(
    (count, itemId) =>
      selectedIds.has(itemId)
        ? count + 1
        : count,
    0,
  );

  const hasItems = itemIds.length > 0;

  const allSelected =
    hasItems &&
    selectedVisibleCount === itemIds.length;

  const partiallySelected =
    selectedVisibleCount > 0 &&
    !allSelected;

  const hasSelection =
    allSelected || partiallySelected;

  const handleCheckedChange = (
    nextChecked: boolean,
  ) => {
    if (nextChecked) {
      selectAll(itemIds);
      return;
    }

    unselectItems(itemIds);
  };

  const label = allSelected
    ? `All ${itemIds.length} selected`
    : partiallySelected
      ? `${selectedVisibleCount} selected`
      : "Select all";

  return (
    <div
      className={cn(
        classes.selectAll,
        !showLabel && classes.iconOnly,
        hasSelection && classes.selected,
        !hasItems && classes.disabled,
        className,
      )}
    >
      <Checkbox
        id={checkboxId}
        checked={allSelected}
        indeterminate={partiallySelected}
        disabled={!hasItems}
        aria-label="Select all visible items"
        classNames={{
          root: classes.checkboxRoot,
          icon: classes.checkboxIcon,
        }}
        onChange={(event) =>
          handleCheckedChange(
            event.target.checked,
          )
        }
      />

      {showLabel && (
        <label
          htmlFor={checkboxId}
          className={classes.label}
        >
          {label}
        </label>
      )}
    </div>
  );
}