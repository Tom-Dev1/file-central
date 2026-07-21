import { ChevronDown, Grid2X2, Info, List, Plus, Search, SlidersHorizontal, Upload } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { driveItems, quickAccessItems } from "./data";
import QuickAccessCard from "./QuickAccessCard";
import { DriveListView } from "./DriveListView";
import DriveGridView from "./DriveGridView";

type ViewMode = "grid" | "list";

export default function MyDrivePage() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return driveItems;
    }

    return driveItems.filter((item) => item.name.toLowerCase().includes(normalizedQuery));
  }, [searchQuery]);

  const allItemsSelected = filteredItems.length > 0 && selectedIds.length === filteredItems.length;

  const partiallySelected = selectedIds.length > 0 && !allItemsSelected;

  function toggleItem(itemId: string) {
    setSelectedIds((currentItems) =>
      currentItems.includes(itemId) ? currentItems.filter((id) => id !== itemId) : [...currentItems, itemId]
    );
  }

  function toggleAllItems() {
    if (allItemsSelected) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(filteredItems.map((item) => item.id));
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Drive</h1>

          <p className="mt-1 text-sm text-muted-foreground">Manage your files, folders, and shared content.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button">
            <Plus className="mr-2 size-4" />
            New
          </Button>

          <Button type="button" variant="outline">
            <Upload className="mr-2 size-4" />
            Upload
          </Button>

          <Button type="button" variant="ghost" size="icon" aria-label="View details">
            <Info className="size-5" />
          </Button>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Quick access</h2>

          <Button type="button" variant="ghost" size="sm">
            View all
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickAccessItems.map((item) => (
            <QuickAccessCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-background">
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              type="search"
              value={searchQuery}
              placeholder="Search files and folders"
              className="pl-9"
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm">
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

            <Button type="button" variant="outline" size="icon" aria-label="Filter files">
              <SlidersHorizontal className="size-4" />
            </Button>

            <div className="flex rounded-md border p-1">
              <Button
                type="button"
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                className="size-8"
                aria-label="List view"
                onClick={() => setViewMode("list")}
              >
                <List className="size-4" />
              </Button>

              <Button
                type="button"
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                className="size-8"
                aria-label="Grid view"
                onClick={() => setViewMode("grid")}
              >
                <Grid2X2 className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        {viewMode === "list" ? (
          <DriveListView
            items={filteredItems}
            selectedIds={selectedIds}
            allItemsSelected={allItemsSelected}
            partiallySelected={partiallySelected}
            onToggleItem={toggleItem}
            onToggleAll={toggleAllItems}
          />
        ) : (
          <DriveGridView items={filteredItems} selectedIds={selectedIds} onToggleItem={toggleItem} />
        )}
      </section>
    </div>
  );
}
