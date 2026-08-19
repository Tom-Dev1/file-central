import { useCallback, useMemo, useState, type MouseEvent, type ReactNode } from "react";

import { Checkbox, Skeleton, type TableColumnsType } from "antd";
import { clsx as cn } from "clsx";

import EmptyFolderState from "@/components/EmptyFolderState";
import { formatDriveFileSize, formatModifiedDate } from "@/constants/file-constants";
import { useDriveSelection } from "@/contexts/driveSelectionContext";
import FileActions from "@/pages/Dashboard/MyDrive/FileActions";
import type { DriveItem, DriveItemKind } from "@/types/api.types";
import type { DriveSortField, DriveSortState } from "@/types/drive.type";

import { DriveListHeader } from "./DriveListHeader";
import { DriveItemNameCell, DriveListActions, DriveListTable } from "./DriveListTable";
import { DriveListRow } from "./DriveListRow";
import { DriveListRowContext, type DriveListRowContextValue } from "./DriveListRowContext";
import { DriveStarButton } from "./DriveStarButton";

import classes from "./DriveListView.module.css";

type DriveListBreakpoint = "xs" | "sm" | "md" | "lg" | "xl" | "xxl";

/** Maps any page-specific record to the fields needed by the shared list behavior. */
export interface DriveListItemAdapter<T extends object> {
  getId: (item: T) => string;
  getName: (item: T) => string;
  getType: (item: T) => DriveItemKind;
  getDriveItem?: (item: T) => DriveItem;
}

export interface DriveListMetadataColumn<T extends object = DriveItem> {
  key: string;
  title: ReactNode;
  field?: DriveSortField;
  width?: number;
  responsive?: DriveListBreakpoint[];
  render: (item: T) => ReactNode;
}

interface DriveListViewBaseProps<T extends object> {
  items: T[];
  loading?: boolean;
  sort?: DriveSortState;
  sortDisabled?: boolean;
  onSortChange?: (sort: DriveSortState) => void;
  onOpenItem?: (item: T) => void;
  onPreviewItem?: (item: T) => void;
  onPrefetchItem?: (item: T) => void;
  selectable?: boolean;
  reserveSelectionSpace?: boolean;
  nameColumnTitle?: ReactNode;
  nameColumnWidth?: number;
  metadataColumns?: DriveListMetadataColumn<T>[];
  renderName?: (item: T, details: ReactNode) => ReactNode;
  renderNameDetails?: (item: T) => ReactNode;
  renderActions?: (item: T) => ReactNode;
  actionsAlwaysVisible?: boolean;
  actionsWidth?: number;
  emptyState?: ReactNode;
  ariaLabel?: string;
  loadingAriaLabel?: string;
  scrollX?: number;
}

export type DriveListViewProps<T extends object = DriveItem> = DriveListViewBaseProps<T> &
  (T extends DriveItem
    ? { itemAdapter?: DriveListItemAdapter<T> }
    : { itemAdapter: DriveListItemAdapter<T> });

interface DriveListSkeletonRow {
  id: string;
}

const DRIVE_LIST_SKELETON_ROWS: DriveListSkeletonRow[] = Array.from({ length: 8 }, (_, index) => ({
  id: `drive-list-skeleton-${index}`,
}));

const DRIVE_ITEM_ADAPTER: DriveListItemAdapter<DriveItem> = {
  getId: (item) => item.id,
  getName: (item) => item.name,
  getType: (item) => item.type,
  getDriveItem: (item) => item,
};

export function DriveListView<T extends object = DriveItem>({
  items,
  itemAdapter,
  loading = false,
  sort,
  sortDisabled = false,
  onSortChange,
  onOpenItem,
  onPreviewItem,
  onPrefetchItem,
  selectable = true,
  reserveSelectionSpace = true,
  nameColumnTitle = "Name",
  nameColumnWidth,
  metadataColumns,
  renderName,
  renderNameDetails,
  renderActions,
  actionsAlwaysVisible = false,
  actionsWidth,
  emptyState,
  ariaLabel = "Drive files",
  loadingAriaLabel = "Loading Drive files",
  scrollX = 744,
}: DriveListViewProps<T>) {
  const adapter = (itemAdapter ?? DRIVE_ITEM_ADAPTER) as DriveListItemAdapter<T>;
  const getDriveItem = adapter.getDriveItem;
  const {
    selectionMode,
    selectedCount,
    isSelected,
    selectOnly,
    toggleItem,
    clearSelection,
  } = useDriveSelection();

  const [previewItemId, setPreviewItemId] = useState<string | null>(null);

  const handleActivateItem = useCallback(
    (item: T) => {
      if (adapter.getType(item) === "folder") {
        if (selectable) {
          clearSelection();
        }

        onOpenItem?.(item);
        return;
      }

      if (onPreviewItem) {
        onPreviewItem(item);
        return;
      }

      if (selectable) {
        const itemId = adapter.getId(item);
        selectOnly(itemId);
        setPreviewItemId(itemId);
      }
    },
    [adapter, clearSelection, onOpenItem, onPreviewItem, selectOnly, selectable],
  );

  const handleRowClick = (event: MouseEvent<HTMLTableRowElement>, item: T) => {
    if (!selectable) {
      handleActivateItem(item);
      return;
    }

    if (event.detail > 1) {
      return;
    }

    const itemId = adapter.getId(item);

    if (selectionMode) {
      toggleItem(itemId);
      return;
    }

    selectOnly(itemId);
  };

  const handleContextSelect = (item: T) => {
    const itemId = adapter.getId(item);

    if (isSelected(itemId)) {
      return;
    }

    if (selectionMode) {
      toggleItem(itemId);
      return;
    }

    selectOnly(itemId);
  };

  const headerCellProps = (field: DriveSortField) => {
    if (!sort || !onSortChange) {
      return {};
    }

    return {
      "aria-sort":
        !sortDisabled && !loading && sort.field === field
          ? sort.direction === "asc"
            ? ("ascending" as const)
            : ("descending" as const)
          : ("none" as const),
    };
  };

  const sortableTitle = (label: ReactNode, field: DriveSortField) => {
    if (typeof label !== "string" || !sort || !onSortChange) {
      return label;
    }

    return (
      <DriveListHeader
        label={label}
        field={field}
        sort={sort}
        disabled={sortDisabled || loading}
        onSortChange={onSortChange}
      />
    );
  };

  const resolvedMetadataColumns: DriveListMetadataColumn<T>[] =
    metadataColumns ??
    (getDriveItem
      ? [
          {
            key: "modified",
            title: "Last modified",
            field: "modified",
            width: 170,
            render: (item) => (
              <span className={classes.metadata}>
                {formatModifiedDate(getDriveItem(item).lastModifiedAt)}
              </span>
            ),
          },
          {
            key: "type",
            title: "Type",
            field: "type",
            width: 110,
            render: (item) => (
              <span className={classes.metadata}>
                {adapter.getType(item) === "folder" ? "Folder" : "File"}
              </span>
            ),
          },
          {
            key: "size",
            title: "File size",
            field: "size",
            width: 120,
            render: (item) => {
              const driveItem = getDriveItem(item);

              return (
                <span className={classes.metadata}>
                  {driveItem.type === "folder" ? "—" : formatDriveFileSize(driveItem)}
                </span>
              );
            },
          },
        ]
      : []);
  const showSelectionColumn = selectable || reserveSelectionSpace;
  const hasDefaultActions = selectable && Boolean(getDriveItem);
  const hasActions = hasDefaultActions || Boolean(renderActions);
  const resolvedActionsWidth = actionsWidth ?? (hasDefaultActions ? 180 : 56);

  const columns: TableColumnsType<T> = [
    ...(showSelectionColumn
      ? [
          {
            key: "selection",
            width: 48,
            className: classes.selectionCell,
            render: (_: unknown, item: T) =>
              selectable && selectionMode ? (
                <Checkbox
                  checked={isSelected(adapter.getId(item))}
                  aria-label={`Select ${adapter.getName(item)}`}
                  onClick={(event) => event.stopPropagation()}
                  onChange={() => toggleItem(adapter.getId(item))}
                />
              ) : null,
          },
        ]
      : []),
    {
      key: "name",
      title: sortableTitle(nameColumnTitle, "name"),
      width: nameColumnWidth,
      onHeaderCell: () => headerCellProps("name"),
      render: (_, item) => {
        const details = renderNameDetails?.(item);

        if (renderName) {
          return renderName(item, details);
        }

        const driveItem = getDriveItem?.(item);

        return driveItem ? (
          <DriveItemNameCell item={driveItem} details={details} />
        ) : (
          <div className={classes.nameContent}>
            <span className={classes.fileName}>{adapter.getName(item)}</span>
            {details && <div className={classes.nameDetails}>{details}</div>}
          </div>
        );
      },
    },
    ...resolvedMetadataColumns.map((column) => ({
      key: column.key,
      title: column.field ? sortableTitle(column.title, column.field) : column.title,
      width: column.width,
      responsive: column.responsive,
      onHeaderCell: column.field ? () => headerCellProps(column.field!) : undefined,
      render: (_: unknown, item: T) => column.render(item),
    })),
    ...(hasActions
      ? [
          {
            key: "actions",
            title: <span className={classes.visuallyHidden}>Actions</span>,
            width: resolvedActionsWidth,
            align: "right" as const,
            className: classes.actionsCell,
            render: (_: unknown, item: T) => {
              if (renderActions) {
                return (
                  <DriveListActions visible={actionsAlwaysVisible}>
                    {renderActions(item)}
                  </DriveListActions>
                );
              }

              const driveItem = getDriveItem?.(item);

              if (!driveItem) {
                return null;
              }

              const itemId = adapter.getId(item);
              const previewOpen = previewItemId === itemId;

              return (
                <div
                  className={classes.defaultActions}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => event.stopPropagation()}
                  onContextMenu={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <FileActions
                    item={driveItem}
                    isPreview={previewOpen}
                    showQuickActions
                    quickActionExtra={<DriveStarButton item={driveItem} />}
                    onPreviewChange={(open) => setPreviewItemId(open ? itemId : null)}
                    onOpenItem={() => handleActivateItem(item)}
                  />
                </div>
              );
            },
          },
        ]
      : []),
  ];

  const skeletonColumns: TableColumnsType<DriveListSkeletonRow> = [
    ...(showSelectionColumn
      ? [
          {
            key: "selection",
            width: 48,
            className: classes.selectionCell,
          },
        ]
      : []),
    {
      key: "name",
      title: sortableTitle(nameColumnTitle, "name"),
      width: nameColumnWidth,
      onHeaderCell: () => headerCellProps("name"),
      render: () => (
        <div className={classes.nameCell}>
          <Skeleton.Avatar active shape="square" size={20} />
          <Skeleton.Input
            active
            size="small"
            className={cn(classes.skeletonLine, classes.skeletonNameLine)}
          />
        </div>
      ),
    },
    ...resolvedMetadataColumns.map((column) => ({
      key: `skeleton-${column.key}`,
      title: column.field ? sortableTitle(column.title, column.field) : column.title,
      width: column.width,
      responsive: column.responsive,
      onHeaderCell: column.field ? () => headerCellProps(column.field!) : undefined,
      render: () => <Skeleton.Input active size="small" className={classes.skeletonLine} />,
    })),
    ...(hasActions
      ? [
          {
            key: "actions",
            title: <span className={classes.visuallyHidden}>Actions</span>,
            width: resolvedActionsWidth,
            align: "right" as const,
            className: classes.actionsCell,
            render: () => (
              <div className={classes.skeletonActionCell}>
                {Array.from({ length: hasDefaultActions ? 5 : 1 }, (_, index) => (
                  <Skeleton.Button
                    key={index}
                    active
                    shape="circle"
                    size="small"
                    className={classes.skeletonAction}
                  />
                ))}
              </div>
            ),
          },
        ]
      : []),
  ];

  const itemByRowKey = useMemo(
    () =>
      new Map(
        items.map((item) => [
          adapter.getId(item),
          { selectionId: adapter.getId(item), type: adapter.getType(item) },
        ]),
      ),
    [adapter, items],
  );
  const recordByRowKey = useMemo(
    () => new Map(items.map((item) => [adapter.getId(item), item])),
    [adapter, items],
  );

  const rowContext = useMemo<DriveListRowContextValue>(
    () => ({
      itemByRowKey,
      selectionMode,
      selectedCount,
      isSelected,
      onOpen: (rowKey) => {
        const item = recordByRowKey.get(rowKey);

        if (item) {
          handleActivateItem(item);
        }
      },
    }),
    [handleActivateItem, isSelected, itemByRowKey, recordByRowKey, selectedCount, selectionMode],
  );

  if (items.length === 0 && loading) {
    return (
      <DriveListTable<DriveListSkeletonRow>
        ariaLabel={loadingAriaLabel}
        aria-busy="true"
        rowKey="id"
        columns={skeletonColumns}
        dataSource={DRIVE_LIST_SKELETON_ROWS}
        scrollX={scrollX}
        rowClassName={classes.skeletonRow}
      />
    );
  }

  if (items.length === 0) {
    return emptyState ?? <EmptyFolderState />;
  }

  const interactive = selectable || Boolean(onOpenItem || onPreviewItem);
  const table = (
    <DriveListTable<T>
      ariaLabel={ariaLabel}
      rowKey={(item) => adapter.getId(item)}
      columns={columns}
      dataSource={items}
      loading={loading}
      locale={{ emptyText: null }}
      components={selectable ? { body: { row: DriveListRow } } : undefined}
      scrollX={scrollX}
      interactive={interactive}
      rowClassName={(item) =>
        cn(selectable && isSelected(adapter.getId(item)) && classes.selectedRow)
      }
      onBackgroundClick={
        selectable
          ? (event) => {
              if (event.target instanceof Element && !event.target.closest("tr")) {
                clearSelection();
              }
            }
          : undefined
      }
      onRow={
        interactive
          ? (item) => ({
              tabIndex: 0,
              ...(selectable ? { "aria-selected": isSelected(adapter.getId(item)) } : {}),
              onClick: (event) => handleRowClick(event, item),
              onDoubleClick: selectable
                ? (event) => {
                    event.preventDefault();
                    handleActivateItem(item);
                  }
                : undefined,
              onContextMenu: selectable ? () => handleContextSelect(item) : undefined,
              onKeyDown: (event) => {
                if (event.key !== "Enter" && (selectable || event.key !== " ")) {
                  return;
                }

                event.preventDefault();
                handleActivateItem(item);
              },
              onPointerEnter:
                adapter.getType(item) === "folder" && onPrefetchItem
                  ? () => onPrefetchItem(item)
                  : undefined,
              onFocus:
                adapter.getType(item) === "folder" && onPrefetchItem
                  ? () => onPrefetchItem(item)
                  : undefined,
            })
          : undefined
      }
    />
  );

  return selectable ? (
    <DriveListRowContext.Provider value={rowContext}>{table}</DriveListRowContext.Provider>
  ) : (
    table
  );
}
