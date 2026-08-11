import type { ReactNode } from "react";
import { RightOutlined } from "@ant-design/icons";
import { Typography } from "antd";
import { clsx as cn } from "clsx";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import classes from "./DriveSubHeader.module.css";

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
    <span className={classes.driveSubHeaderTitleContent}>
      {Icon && (
        <Icon
          aria-hidden="true"
          className={classes.driveSubHeaderTitleIcon}
          size={20}
          strokeWidth={1.8}
        />
      )}
      <span className={classes.driveSubHeaderTitleText}>{title}</span>
    </span>
  );

  return (
    <section className={cn(classes.driveSubHeader, className)}>
      <div className={classes.driveSubHeaderBody}>
        {leading && (
          <div className={classes.driveSubHeaderLeading}>{leading}</div>
        )}

        <div className={classes.driveSubHeaderContent}>
          <nav
            aria-label="Breadcrumb"
            className={classes.driveSubHeaderBreadcrumb}
          >
            <div className={classes.driveSubHeaderBreadcrumbTrack}>
              {titleHref ? (
                <Link
                  aria-label={`Go to ${title}`}
                  className={classes.driveSubHeaderBreadcrumbLink}
                  to={titleHref}
                >
                  {titleContent}
                </Link>
              ) : (
                <span
                  aria-current={folderBreadcrumbs ? undefined : "page"}
                  className={classes.driveSubHeaderBreadcrumbCurrent}
                >
                  {titleContent}
                </span>
              )}

              {folderBreadcrumbs && (
                <>
                  <RightOutlined
                    aria-hidden="true"
                    className={classes.driveSubHeaderBreadcrumbSeparator}
                  />
                  <div className={classes.driveSubHeaderFolderBreadcrumbs}>
                    {folderBreadcrumbs}
                  </div>
                </>
              )}
            </div>
          </nav>

          {description && (
            <Typography.Text
              className={classes.driveSubHeaderDescription}
              type="secondary"
            >
              {description}
            </Typography.Text>
          )}
        </div>
      </div>

      {actions && (
        <div className={classes.driveSubHeaderActions}>{actions}</div>
      )}
    </section>
  );
}