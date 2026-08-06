import { Checkbox } from "antd";
import { useDriveSelection } from "@/contexts/driveSelectionContext";
import { cn } from "@/lib/utils";

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
    <div className={cn("flex h-7 items-center gap-2", className)}>
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
            "cursor-pointer whitespace-nowrap text-sm font-normal mt-0.5 px-1",
            !hasItems && "cursor-not-allowed text-muted-foreground"
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
