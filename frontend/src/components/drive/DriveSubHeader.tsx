import type { ReactNode } from "react";
import { RightOutlined } from "@ant-design/icons";
import { Typography } from "antd";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

interface DriveSubHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  leading?: ReactNode;
  actions?: ReactNode;
  className?: string;
  folderBreadcrumbs?: ReactNode;
  titleHref?: string | null;
}

export function DriveSubHeader({
  title,
  description,
  icon: Icon,
  leading,
  actions,
  className,
  folderBreadcrumbs,
  titleHref = "/dashboard",
}: DriveSubHeaderProps) {
  const titleContent = (
    <>
      {Icon && (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:size-10">
          <Icon className="size-5" />
        </span>
      )}
      <h1 className="whitespace-nowrap text-lg font-semibold tracking-tight sm:text-2xl">{title}</h1>
    </>
  );

  return (
    <section
      className={cn(
        "flex min-h-20 flex-col items-stretch justify-between gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-6 sm:py-4",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        {leading && <div className="mb-2 min-w-0">{leading}</div>}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {titleHref ? (
            <Link
              to={titleHref}
              aria-label={`Go to ${title}`}
              className="flex shrink-0 items-center gap-2 rounded-lg text-foreground outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary sm:gap-3"
            >
              {titleContent}
            </Link>
          ) : (
            <div className="flex shrink-0 items-center gap-2 text-foreground sm:gap-3">{titleContent}</div>
          )}
          {folderBreadcrumbs && (
            <>
              <RightOutlined className="shrink-0 text-xs text-muted-foreground" />
              <div className="min-w-0 flex-1 overflow-hidden">{folderBreadcrumbs}</div>
            </>
          )}
        </div>
        {description && (
          <Typography.Text type="secondary" className="!mt-1 block truncate !text-xs sm:!ml-[52px] sm:!text-sm">
            {description}
          </Typography.Text>
        )}
      </div>

      {actions && (
        <div className="flex w-full min-w-0 items-center overflow-x-auto pb-1 sm:w-auto sm:shrink-0 sm:overflow-visible sm:pb-0">
          {actions}
        </div>
      )}
    </section>
  );
}
