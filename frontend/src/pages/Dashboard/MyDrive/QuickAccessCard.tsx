import { Button, Card } from "antd";
import type { DriveItem } from "@/types/api.types";
import { fileIcons } from "@/types/file-type";
import { MoreVertical, Share2, Star } from "lucide-react";

interface QuickAccessCardProps {
  item: DriveItem;
}

export default function QuickAccessCard({ item }: QuickAccessCardProps) {
  const Icon = fileIcons[item.type];

  return (
    <Card hoverable className="group cursor-pointer" styles={{ body: { padding: 16 } }}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-medium" title={item.name}>{item.name}</span>
            {item.sizeBytes && <Share2 className="size-3.5 shrink-0 text-muted-foreground" />}
            {item.ownerId && <Star className="size-3.5 shrink-0 fill-current text-muted-foreground" />}
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <span className="truncate">{item.createdAt}</span>
            {item.sizeBytes && <><span aria-hidden="true">·</span><span className="shrink-0">{item.sizeBytes}</span></>}
          </div>
        </div>
        <Button type="text" shape="circle" size="small" aria-label={`Open actions for ${item.name}`} icon={<MoreVertical className="size-4" />} />
      </div>
    </Card>
  );
}
