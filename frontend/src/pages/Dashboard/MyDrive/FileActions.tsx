import { FilePreviewDialog } from "@/components/file-preview/FilePreviewDialog";
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
import { useState } from "react";

interface FileActionsProps {
  item: DriveItem;
  isPreview?: boolean;
  onPreviewChange?: (open: boolean) => void;
}

export default function FileActions({ item, isPreview, onPreviewChange }: FileActionsProps) {
  const [internalPreviewOpen, setInternalPreviewOpen] = useState(false);

  const previewOpen = isPreview ?? internalPreviewOpen;

  const setPreviewOpen = (open: boolean) => {
    if (isPreview === undefined) {
      setInternalPreviewOpen(open);
    }

    onPreviewChange?.(open);
  };

  const handleOpen = () => {
    setPreviewOpen(true);
  };

  return (
    <DropdownMenu modal={true}>
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

      <DropdownMenuContent align="end" className="p-2 w-full  rounded-xs">
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
          <SendToBack />
          Rename
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem variant="destructive" className="rounded-xs px-4">
          <LucideDelete /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
      {item.type === "file" && <FilePreviewDialog item={item} open={previewOpen} onOpenChange={setPreviewOpen} />}
    </DropdownMenu>
  );
}
