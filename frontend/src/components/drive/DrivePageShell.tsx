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
    <div className={cn(classes.column, className)}>
      <div className={classes.div}>{header}</div>

      <div className={cn(classes.div2, contentClassName)}>
        {children}
      </div>
    </div>
  );
}
