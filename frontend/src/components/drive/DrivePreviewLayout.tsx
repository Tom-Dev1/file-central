import type { ReactNode } from "react";

import type { DriveItem } from "@/types/api.types";
import { DrivePreviewPane } from "./DrivePreviewPane";
import classes from "./DrivePreviewLayout.module.css";

interface DrivePreviewLayoutProps {
  children: ReactNode;
  open: boolean;
  item: DriveItem | null;
  selectedCount: number;
  onClose: () => void;
}

export function DrivePreviewLayout({ children, open, item, selectedCount, onClose }: DrivePreviewLayoutProps) {
  return (
    <div className={classes.layout}>
      <div className={classes.main}>{children}</div>
      {open && <DrivePreviewPane item={item} selectedCount={selectedCount} onClose={onClose} />}
    </div>
  );
}
