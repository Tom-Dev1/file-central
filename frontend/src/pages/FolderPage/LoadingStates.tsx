import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  message?: string;
  className?: string;
  fullHeight?: boolean;
}

export function LoadingState({ message = "Loading data...", className, fullHeight = false }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex w-full flex-col items-center justify-center gap-3",
        fullHeight ? "min-h-[calc(100vh-160px)]" : "min-h-[300px]",
        className
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <LoaderCircle className="size-6 animate-spin text-primary" />
      </div>

      <div className="space-y-1 text-center">
        <p className="text-sm font-medium text-foreground">{message}</p>
        <p className="text-xs text-muted-foreground">Please wait while we fetch your data.</p>
      </div>

      <span className="sr-only">{message}</span>
    </div>
  );
}
