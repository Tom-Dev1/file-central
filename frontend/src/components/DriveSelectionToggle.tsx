import { CheckSquare2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
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
      type="button"
      variant={selectionMode ? "secondary" : "ghost"}
      size={showLabel ? "sm" : "icon"}
      className={cn(showLabel ? "h-8 gap-2" : "size-7", className)}
      aria-label={selectionMode ? "Disable selection mode" : "Enable selection mode"}
      aria-pressed={selectionMode}
      onClick={toggleSelectionMode}
    >
      {selectionMode ? <X className="size-4" /> : <CheckSquare2 className="size-4" />}

      {showLabel && (
        <span>
          {selectionMode ? (selectedCount > 0 ? `${selectedCount} selected` : "Cancel selection") : "Select items"}
        </span>
      )}
    </Button>
  );
}
