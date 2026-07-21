import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MoreVertical, Share2, Star } from "lucide-react";
import { fileIcons } from "./data";
type FileType = "folder" | "document" | "spreadsheet" | "image" | "archive" | "file";

interface DriveItem {
  id: string;
  name: string;
  type: FileType;
  owner: string;
  modifiedAt: string;
  size: string;
  shared?: boolean;
  starred?: boolean;
}
interface QuickAccessCardProps {
  item: DriveItem;
}
export default function QuickAccessCard({ item }: QuickAccessCardProps) {
  const Icon = fileIcons[item.type];

  return (
    <Card className="group cursor-pointer border-border/70 transition-all hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" />
          </span>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 opacity-0 transition-opacity group-hover:opacity-100"
            aria-label={`Open actions for ${item.name}`}
          >
            <MoreVertical className="size-4" />
          </Button>
        </div>

        <p className="mt-4 truncate text-sm font-medium">{item.name}</p>

        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{item.modifiedAt}</span>

          <div className="flex items-center gap-1">
            {item.shared && <Share2 className="size-3.5" />}
            {item.starred && <Star className="size-3.5 fill-current" />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
