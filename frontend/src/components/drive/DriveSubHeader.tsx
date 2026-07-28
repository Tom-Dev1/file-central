import type { ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface DriveSubHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  leading?: ReactNode;
  actions?: ReactNode;
  className?: string;
  folderBreadcrumbs?: ReactNode;
}

export function DriveSubHeader({
  title,
  icon: Icon,
  leading,
  actions,
  className,
  folderBreadcrumbs,
}: DriveSubHeaderProps) {
  const navigate = useNavigate();
  return (
    <section className={cn("flex min-h-20 items-center justify-between gap-4 px-4 py-4 sm:px-6", className)}>
      <div className="min-w-0">
        {leading && <div className="mb-2 min-w-0">{leading}</div>}
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 items-center gap-3 cursor-pointer" onClick={() => navigate("/dashboard")}>
            {Icon && (
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" />
              </div>
            )}

            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
            </div>
          </div>
          {folderBreadcrumbs && (
            <>
              <ChevronRight className=" size-4 text-muted-foreground" />
              {folderBreadcrumbs}
            </>
          )}
        </div>
      </div>

      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </section>
  );
}
