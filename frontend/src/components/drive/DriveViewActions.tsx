import { ChevronDown, Grid2X2, List, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  return (
    <div className="flex items-center gap-2">
      <PopoverUpload parentId={parentId} className="h-9 rounded-xl" />

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" className="h-9">
            Last modified
            <ChevronDown className="ml-2 size-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuItem>Name</DropdownMenuItem>

          <DropdownMenuItem>Last modified</DropdownMenuItem>

          <DropdownMenuItem>Last opened</DropdownMenuItem>

          <DropdownMenuItem>File size</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex h-9 items-center rounded-lg border bg-background py-1 px-3">
        {selectionMode === true && <DriveSelectAll itemIds={itemIds} />}

        <DriveSelectionToggle />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={isFetching}
          aria-label="Refresh files"
          onClick={onRefresh}
        >
          <RefreshCw className={isFetching ? "size-4 animate-spin" : "size-4"} />
        </Button>

        <Button
          type="button"
          variant={viewMode === "list" ? "secondary" : "ghost"}
          size="icon"
          className="size-7"
          aria-label="List view"
          onClick={() => onViewModeChange("list")}
        >
          <List className="size-4" />
        </Button>

        <Button
          type="button"
          variant={viewMode === "grid" ? "secondary" : "ghost"}
          size="icon"
          className="size-7"
          aria-label="Grid view"
          onClick={() => onViewModeChange("grid")}
        >
          <Grid2X2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
