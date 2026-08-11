import type { ReactNode } from "react";
import { clsx as cn } from "clsx";

import classes from "./DrivePageShell.module.css";

interface DrivePageShellProps {
  header: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function DrivePageShell({ header, children, className, contentClassName }: DrivePageShellProps) {
  return (
    <div className={cn(classes.shell, className)}>
      <header className={classes.header}>{header}</header>

      <div className={cn(classes.content, contentClassName)}>{children}</div>
    </div>
  );
}
