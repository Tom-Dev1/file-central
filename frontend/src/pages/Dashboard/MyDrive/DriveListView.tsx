import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fileIcons, type DriveItem } from "./data";
import EmptyState from "./EmptyState";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Share2, Star } from "lucide-react";
import FileActions from "./FileActions";

interface DriveListViewProps {
  items: DriveItem[];
  selectedIds: string[];
  allItemsSelected: boolean;
  partiallySelected: boolean;
  onToggleItem: (itemId: string) => void;
  onToggleAll: () => void;
}

export function DriveListView({
  items,
  selectedIds,
  allItemsSelected,
  partiallySelected,
  onToggleItem,
  onToggleAll,
}: DriveListViewProps) {
  if (items.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                aria-label="Select all files"
                checked={allItemsSelected ? true : partiallySelected ? "indeterminate" : false}
                onCheckedChange={onToggleAll}
              />
            </TableHead>

            <TableHead>Name</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Last modified</TableHead>
            <TableHead>File size</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>

        <TableBody>
          {items.map((item) => {
            const Icon = fileIcons[item.type];
            const selected = selectedIds.includes(item.id);

            return (
              <TableRow key={item.id} data-state={selected ? "selected" : undefined} className="group cursor-pointer">
                <TableCell>
                  <Checkbox
                    checked={selected}
                    aria-label={`Select ${item.name}`}
                    onCheckedChange={() => onToggleItem(item.id)}
                  />
                </TableCell>

                <TableCell>
                  <div className="flex min-w-56 items-center gap-3">
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                        item.type === "folder" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="size-5" />
                    </span>

                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.name}</p>

                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground md:hidden">
                        <span>{item.modifiedAt}</span>
                        <span>·</span>
                        <span>{item.size}</span>
                      </div>
                    </div>

                    {item.shared && <Share2 className="size-4 text-muted-foreground" />}

                    {item.starred && <Star className="size-4 fill-current text-muted-foreground" />}
                  </div>
                </TableCell>

                <TableCell className="text-muted-foreground">{item.owner}</TableCell>

                <TableCell className="text-muted-foreground">{item.modifiedAt}</TableCell>

                <TableCell className="text-muted-foreground">{item.size}</TableCell>

                <TableCell>
                  <FileActions item={item} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
