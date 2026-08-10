import { Checkbox } from "antd";
import { useDriveSelection } from "@/contexts/driveSelectionContext";
import { clsx as cn } from "clsx";
import classes from "./DriveSelectAll.module.css";


interface DriveSelectAllProps {
  itemIds: string[];
  className?: string;
  showLabel?: boolean;
}

export function DriveSelectAll({ itemIds, className, showLabel = true }: DriveSelectAllProps) {
  const { selectedIds, selectAll, unselectItems } = useDriveSelection();

  const selectedVisibleCount = itemIds.reduce((count, itemId) => (selectedIds.has(itemId) ? count + 1 : count), 0);

  const hasItems = itemIds.length > 0;

  const allSelected = hasItems && selectedVisibleCount === itemIds.length;

  const partiallySelected = selectedVisibleCount > 0 && !allSelected;

  const handleCheckedChange = (nextChecked: boolean) => {
    if (nextChecked) {
      selectAll(itemIds);
      return;
    }

    unselectItems(itemIds);
  };

  return (
    <div className={cn(classes.row, className)}>
      <Checkbox
        id="drive-select-all"
        checked={allSelected}
        indeterminate={partiallySelected}
        disabled={!hasItems}
        aria-label="Select all visible items"
        onChange={(event) => handleCheckedChange(event.target.checked)}
      />

      {showLabel && (
        <label
          htmlFor="drive-select-all"
          className={cn(
            classes.label,
            !hasItems && classes.label2
          )}
        >
          {allSelected
            ? `All ${itemIds.length} selected`
            : partiallySelected
            ? `${selectedVisibleCount} selected`
            : "Select all"}
        </label>
      )}
    </div>
  );
}
