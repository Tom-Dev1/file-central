import { Skeleton } from "@/components/ui/skeleton";

interface DriveContentSkeletonProps {
  viewMode: "grid" | "list";
}

export function DriveContentSkeleton({ viewMode }: DriveContentSkeletonProps) {
  if (viewMode === "list") {
    return (
      <div className="space-y-1 p-4 sm:p-6">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="flex h-14 items-center gap-3 rounded-lg px-3">
            <Skeleton className="size-5 shrink-0 rounded" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="ml-auto h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="rounded-xl border p-4">
          <div className="flex justify-between">
            <Skeleton className="size-5 rounded" />
            <Skeleton className="size-7 rounded-full" />
          </div>

          <div className="flex justify-center py-8">
            <Skeleton className="size-16 rounded-xl" />
          </div>

          <Skeleton className="h-4 w-3/4" />

          <div className="mt-4 flex justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}
