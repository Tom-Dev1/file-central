import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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

  const checked = partiallySelected ? "indeterminate" : allSelected;

  const handleCheckedChange = (nextChecked: boolean | "indeterminate") => {
    if (nextChecked === true || nextChecked === "indeterminate") {
      selectAll(itemIds);
      return;
    }

    unselectItems(itemIds);
  };

  return (
    <div className={cn("flex h-7 items-center gap-2", className)}>
      <Checkbox
        id="drive-select-all"
        checked={checked}
        disabled={!hasItems}
        aria-label="Select all visible items"
        onCheckedChange={handleCheckedChange}
      />

      {showLabel && (
        <Label
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
        </Label>
      )}
    </div>
  );
}
