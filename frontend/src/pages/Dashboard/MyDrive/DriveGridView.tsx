import { Card, CardContent } from "@/components/ui/card";
import { fileIcons, type DriveItem } from "./data";
import EmptyState from "./EmptyState";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import FileActions from "./FileActions";

interface DriveGridViewProps {
  items: DriveItem[];
  selectedIds: string[];
  onToggleItem: (itemId: string) => void;
}

export default function DriveGridView({ items, selectedIds, onToggleItem }: DriveGridViewProps) {
  if (items.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {items.map((item) => {
        const Icon = fileIcons[item.type];
        const selected = selectedIds.includes(item.id);

        return (
          <Card
            key={item.id}
            className={cn("group cursor-pointer transition-colors", selected && "border-primary bg-primary/5")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Checkbox
                  checked={selected}
                  aria-label={`Select ${item.name}`}
                  onCheckedChange={() => onToggleItem(item.id)}
                />

                <FileActions item={item} />
              </div>

              <div className="my-7 flex justify-center">
                <span className="flex size-20 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Icon className="size-10" />
                </span>
              </div>

              <div className="flex min-w-0 items-center gap-2">
                <Icon className="size-4 shrink-0 text-primary" />

                <p className="truncate text-sm font-medium">{item.name}</p>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{item.modifiedAt}</span>
                <span>{item.size}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
