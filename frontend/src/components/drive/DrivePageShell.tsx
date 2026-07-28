import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface DrivePageShellProps {
  header: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function DrivePageShell({ header, children, className, contentClassName }: DrivePageShellProps) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col overflow-hidden", className)}>
      <div className="relative z-20 shrink-0 border-b bg-background/95 backdrop-blur">{header}</div>

      <div className={cn("custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain", contentClassName)}>
        {children}
      </div>
    </div>
  );
}
