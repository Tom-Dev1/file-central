import { ChevronRight, LoaderCircle, MoreHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useFolderBreadcrumbs } from "@/hooks/useDrive";
import { getBreadcrumbParts } from "@/constants/file-constants";
import type { FolderBreadcrumbItem } from "@/types/drive.type";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { driveKeys } from "@/lib/query-keys";
import { startTransition } from "react";
import { Skeleton } from "./ui/skeleton";
import { cn } from "@/lib/utils";

interface FolderBreadcrumbsProps {
  folderId: string;
  className?: string;
}

export function FolderBreadcrumbs({ folderId, className }: FolderBreadcrumbsProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: breadcrumbs = [], isLoading, isFetching, isPending } = useFolderBreadcrumbs(folderId);
  const { visible, hidden } = getBreadcrumbParts(breadcrumbs);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }
  const handleNavigate = (item: FolderBreadcrumbItem) => {
    if (item.id === folderId || item.id === "collapsed") {
      return;
    }

    const targetIndex = breadcrumbs.findIndex((breadcrumb) => breadcrumb.id === item.id);

    /*
     * The target breadcrumb already exists inside the current path.
     * Seed its query cache before navigation so the header does not
     * disappear while the API request runs.
     */
    if (targetIndex >= 0) {
      queryClient.setQueryData<FolderBreadcrumbItem[]>(
        driveKeys.breadcrumb(item.id),
        breadcrumbs.slice(0, targetIndex + 1)
      );
    }

    startTransition(() => {
      navigate(`/dashboard/folders/${item.id}`);
    });
  };
  if (isPending && breadcrumbs.length === 0) {
    return (
      <div className={cn("flex min-h-9 items-center gap-2", className)}>
        <Skeleton className="h-8 w-24 rounded-md" />
        <ChevronRight className="size-4 text-muted-foreground/40" />
        <Skeleton className="h-8 w-36 rounded-md" />
      </div>
    );
  }
  return (
    <nav aria-label="Folder breadcrumb" className={cn("flex min-h-9 min-w-0 items-center text-2xl", className)}>
      <div className="flex min-w-0 items-center gap-1 overflow-hidden">
        {visible.map((item, index) => {
          const isCollapsed = item.id === "collapsed";

          const isCurrent = item.id === folderId;

          return (
            <div key={item.id} className="flex min-w-0 shrink-0 items-center">
              {index > 0 && <ChevronRight className="mx-1 size-4 shrink-0 text-muted-foreground/60" />}

              {isCollapsed ? (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      aria-label="Show hidden folders"
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="start" className="w-56">
                    {hidden.map((hiddenItem) => (
                      <DropdownMenuItem
                        key={hiddenItem.id}
                        className="cursor-pointer"
                        onSelect={() => handleNavigate(hiddenItem)}
                      >
                        <span className="truncate" title={hiddenItem.name}>
                          {hiddenItem.name}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : isCurrent ? (
                <span
                  aria-current="page"
                  className="max-w-64 truncate px-1 py-1 font-medium text-foreground"
                  title={item.name}
                >
                  {item.name}
                </span>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto max-w-48 shrink-0 truncate px-1 py-1 text-2xl font-normal text-muted-foreground hover:text-foreground"
                  title={item.name}
                  onClick={() => handleNavigate(item)}
                >
                  <span className="truncate">{item.name}</span>
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/*
       * Always reserve this space so the breadcrumb width does not
       * jump when background fetching starts or finishes.
       */}
      <span className="ml-1 flex size-5 shrink-0 items-center justify-center">
        {isFetching && breadcrumbs.length > 0 && (
          <LoaderCircle aria-label="Updating breadcrumb" className="size-3.5 animate-spin text-muted-foreground" />
        )}
      </span>
    </nav>
  );
}
