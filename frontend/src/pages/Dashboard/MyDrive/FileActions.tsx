import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Share2, Star } from "lucide-react";
import type { DriveItem } from "./data";

interface FileActionsProps {
  item: DriveItem;
}

export default function FileActions({ item }: FileActionsProps) {
  return (
    <DropdownMenu>
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

      <DropdownMenuContent align="end">
        <DropdownMenuItem>Open</DropdownMenuItem>

        <DropdownMenuItem>
          <Share2 className="mr-2 size-4" />
          Share
        </DropdownMenuItem>

        <DropdownMenuItem>
          <Star className="mr-2 size-4" />
          Add to starred
        </DropdownMenuItem>

        <DropdownMenuItem>Rename</DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
