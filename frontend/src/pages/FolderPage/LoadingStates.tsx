import { Spin, Typography } from "antd";
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
      <Spin size="large" />

      <div className="space-y-1 text-center">
        <Typography.Text strong className="block !text-sm">
          {message}
        </Typography.Text>
        <Typography.Text type="secondary" className="block !text-xs">
          Please wait while we fetch your data.
        </Typography.Text>
      </div>

      <span className="sr-only">{message}</span>
    </div>
  );
}
