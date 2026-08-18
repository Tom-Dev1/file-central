import type { MouseEventHandler, ReactNode } from "react";

import { Table, Typography, type TableProps } from "antd";
import { clsx as cn } from "clsx";

import { ThemedSvgIcon } from "@/components/theme/ThemedSvgIcon";
import type { DriveItem } from "@/types/api.types";
import { getDriveItemIcon } from "@/utils/file-utils";

import classes from "./DriveListView.module.css";

const driveTableClassNames = {
  root: classes.table,
  section: classes.tableSection,
  content: classes.tableContent,
  header: {
    row: classes.headerRow,
    cell: classes.headerCell,
  },
  body: {
    row: classes.bodyRow,
    cell: classes.bodyCell,
  },
};

type DriveListTableProps<T extends object> = Omit<
  TableProps<T>,
  "classNames" | "pagination" | "scroll" | "tableLayout"
> & {
  ariaLabel: string;
  interactive?: boolean;
  scrollX?: number;
  onBackgroundClick?: MouseEventHandler<HTMLDivElement>;
};

export function DriveListTable<T extends object>({
  ariaLabel,
  interactive = false,
  scrollX,
  rowClassName,
  onBackgroundClick,
  ...tableProps
}: DriveListTableProps<T>) {
  return (
    <div className={classes.list} onClick={onBackgroundClick}>
      <Table<T>
        {...tableProps}
        aria-label={ariaLabel}
        pagination={false}
        tableLayout="fixed"
        scroll={scrollX ? { x: scrollX } : undefined}
        classNames={driveTableClassNames}
        rowClassName={(record, index, indent) =>
          cn(
            interactive && classes.interactiveRow,
            typeof rowClassName === "function" ? rowClassName(record, index, indent) : rowClassName,
          )
        }
      />
    </div>
  );
}

interface DriveItemNameCellProps {
  item: DriveItem;
  details?: ReactNode;
}

export function DriveItemNameCell({ item, details }: DriveItemNameCellProps) {
  return (
    <div className={classes.nameCell}>
      <ThemedSvgIcon src={getDriveItemIcon(item)} size={20} className={classes.icon} />
      <div className={classes.nameContent}>
        <Typography.Text ellipsis={{ tooltip: item.name }} className={classes.fileName}>
          {item.name}
        </Typography.Text>
        {details && <div className={classes.nameDetails}>{details}</div>}
      </div>
    </div>
  );
}

interface DriveListMetadataCellProps {
  children: ReactNode;
}

export function DriveListMetadataCell({ children }: DriveListMetadataCellProps) {
  return <span className={classes.metadata}>{children}</span>;
}

interface DriveListActionsProps {
  children: ReactNode;
  visible?: boolean;
}

export function DriveListActions({ children, visible = false }: DriveListActionsProps) {
  return (
    <div
      className={cn(classes.actions, visible && classes.actionsVisible)}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}
