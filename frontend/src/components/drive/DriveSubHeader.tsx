import type { ReactNode } from "react";
import { RightOutlined } from "@ant-design/icons";
import { Typography } from "antd";
import type { LucideIcon } from "lucide-react";

import { clsx as cn } from "clsx";
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
    <>
      {Icon && (
        <span className={classes.centeredRow}>
          <Icon className={classes.icon} />
        </span>
      )}
      <h1 className={classes.title}>{title}</h1>
    </>
  );

  return (
    <section
      className={cn(
        classes.section,
        className
      )}
    >
      <div className={classes.div}>
        {leading && <div className={classes.div2}>{leading}</div>}
        <div className={classes.row}>
          {titleHref ? (
            <Link
              to={titleHref}
              aria-label={`Go to ${title}`}
              className={classes.row2}
            >
              {titleContent}
            </Link>
          ) : (
            <div className={classes.row3}>{titleContent}</div>
          )}
          {folderBreadcrumbs && (
            <>
              <RightOutlined className={classes.icon2} />
              <div className={classes.div3}>{folderBreadcrumbs}</div>
            </>
          )}
        </div>
        {description && (
          <Typography.Text type="secondary" className={classes.truncatedText}>
            {description}
          </Typography.Text>
        )}
      </div>

      {actions && (
        <div className={classes.row4}>
          {actions}
        </div>
      )}
    </section>
  );
}
