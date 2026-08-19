import {
  useLayoutEffect,
  useRef,
  useState,
  type MouseEventHandler,
  type ReactNode,
} from "react";

import { Table, Typography, type TableProps } from "antd";
import { clsx as cn } from "clsx";

import { ThemedSvgIcon } from "@/components/theme/ThemedSvgIcon";
import type { DriveItem } from "@/types/api.types";
import { getDriveItemIcon } from "@/utils/file-utils";

import tableClasses from "./DriveListTable.module.css";
import viewClasses from "./DriveListView.module.css";

const driveTableClassNames = {
  root: tableClasses.table,
  section: tableClasses.tableSection,
  header: {
    row: tableClasses.headerRow,
    cell: tableClasses.headerCell,
  },
  body: {
    row: tableClasses.bodyRow,
    cell: tableClasses.bodyCell,
  },
};

/**
 * Ant Design fixes the table header when `scroll.y` is defined. Keep that value
 * in sync with the actual flex viewport instead of coupling the table to a
 * page-specific `calc(100vh - ...)` expression.
 */
function useAutoTableBodyHeight() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [bodyHeight, setBodyHeight] = useState(0);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    let header: HTMLTableSectionElement | null = null;

    const resizeObserver = new ResizeObserver(() => {
      const nextHeader = viewport.querySelector<HTMLTableSectionElement>("thead");

      if (header !== nextHeader) {
        if (header) {
          resizeObserver.unobserve(header);
        }

        header = nextHeader;

        if (header) {
          resizeObserver.observe(header);
        }
      }

      const nextBodyHeight = Math.max(
        0,
        Math.floor(viewport.clientHeight - (header?.offsetHeight ?? 0)),
      );

      setBodyHeight((currentHeight) =>
        currentHeight === nextBodyHeight ? currentHeight : nextBodyHeight,
      );
    });

    resizeObserver.observe(viewport);

    return () => resizeObserver.disconnect();
  }, []);

  return { viewportRef, bodyHeight };
}

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
  const { viewportRef, bodyHeight } = useAutoTableBodyHeight();

  return (
    <div ref={viewportRef} className={tableClasses.viewport} onClick={onBackgroundClick}>
      <Table<T>
        {...tableProps}
        aria-label={ariaLabel}
        pagination={false}
        tableLayout="fixed"
        scroll={{ ...(scrollX ? { x: scrollX } : {}), y: bodyHeight }}
        classNames={driveTableClassNames}
        rowClassName={(record, index, indent) =>
          cn(
            interactive && viewClasses.interactiveRow,
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
    <div className={viewClasses.nameCell}>
      <ThemedSvgIcon src={getDriveItemIcon(item)} size={20} className={viewClasses.icon} />
      <div className={viewClasses.nameContent}>
        <Typography.Text ellipsis={{ tooltip: item.name }} className={viewClasses.fileName}>
          {item.name}
        </Typography.Text>
        {details && <div className={viewClasses.nameDetails}>{details}</div>}
      </div>
    </div>
  );
}

interface DriveListMetadataCellProps {
  children: ReactNode;
}

export function DriveListMetadataCell({ children }: DriveListMetadataCellProps) {
  return <span className={viewClasses.metadata}>{children}</span>;
}

interface DriveListActionsProps {
  children: ReactNode;
  visible?: boolean;
}

export function DriveListActions({ children, visible = false }: DriveListActionsProps) {
  return (
    <div
      className={cn(viewClasses.actions, visible && viewClasses.actionsVisible)}
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
