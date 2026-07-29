import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DriveItem } from "@/types/api.types";
import { FolderOpen, LucideDelete, MoreVertical, SendToBack, Share2, Star } from "lucide-react";

interface FileActionsProps {
  item: DriveItem;
  onPreview?: () => void;
  onOpenFolder?: () => void;
}

export default function FileActions({ item, onPreview, onOpenFolder }: FileActionsProps) {
  const handleOpen = () => {
    if (item.type === "folder") {
      onOpenFolder?.();
      return;
    }

    onPreview?.();
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={`Open actions for ${item.name}`}
        >
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52 rounded-xs p-2">
        <DropdownMenuItem className="rounded-xs px-4" onSelect={handleOpen}>
          <FolderOpen className="mr-1 size-4" />

          {item.type === "folder" ? "Open" : "Preview"}
        </DropdownMenuItem>

        <DropdownMenuItem className="rounded-xs px-4">
          <Share2 className="mr-1 size-4" />
          Share with
        </DropdownMenuItem>

        <DropdownMenuItem className="rounded-xs px-4">
          <Star className="mr-1 size-4" />
          Add to starred
        </DropdownMenuItem>

        <DropdownMenuItem className="rounded-xs px-4">
          <SendToBack className="mr-1 size-4" />
          Rename
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem variant="destructive" className="rounded-xs px-4">
          <LucideDelete className="mr-1 size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
