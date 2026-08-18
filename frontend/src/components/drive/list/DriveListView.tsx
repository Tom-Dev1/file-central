import { useCallback, useMemo, useState, type MouseEvent, type ReactNode } from "react";

import { Checkbox, Skeleton, type TableColumnsType } from "antd";
import { clsx as cn } from "clsx";

import EmptyFolderState from "@/components/EmptyFolderState";
import { formatDriveFileSize, formatModifiedDate } from "@/constants/file-constants";
import { useDriveSelection } from "@/contexts/driveSelectionContext";
import FileActions from "@/pages/Dashboard/MyDrive/FileActions";
import type { DriveItem } from "@/types/api.types";
import type { DriveSortField, DriveSortState } from "@/types/drive.type";

import { DriveListHeader } from "./DriveListHeader";
import { DriveItemNameCell, DriveListActions, DriveListTable } from "./DriveListTable";
import { DriveListRow } from "./DriveListRow";
import { DriveListRowContext, type DriveListRowContextValue } from "./DriveListRowContext";

import classes from "./DriveListView.module.css";

type DriveListBreakpoint = "xs" | "sm" | "md" | "lg" | "xl" | "xxl";

export interface DriveListMetadataColumn {
  key: string;
  title: ReactNode;
  field?: DriveSortField;
  width?: number;
  responsive?: DriveListBreakpoint[];
  render: (item: DriveItem) => ReactNode;
}

interface DriveListViewProps {
  items: DriveItem[];
  loading?: boolean;
  sort?: DriveSortState;
  sortDisabled?: boolean;
  onSortChange?: (sort: DriveSortState) => void;
  onOpenItem?: (item: DriveItem) => void;
  onPreviewItem?: (item: DriveItem) => void;
  onPrefetchItem?: (item: DriveItem) => void;
  selectable?: boolean;
  reserveSelectionSpace?: boolean;
  metadataColumns?: DriveListMetadataColumn[];
  renderNameDetails?: (item: DriveItem) => ReactNode;
  renderActions?: (item: DriveItem) => ReactNode;
  actionsAlwaysVisible?: boolean;
  actionsWidth?: number;
  emptyState?: ReactNode;
  ariaLabel?: string;
  loadingAriaLabel?: string;
  scrollX?: number;
}

interface DriveListSkeletonRow {
  id: string;
}

const DRIVE_LIST_SKELETON_ROWS: DriveListSkeletonRow[] = Array.from({ length: 8 }, (_, index) => ({
  id: `drive-list-skeleton-${index}`,
}));

export function DriveListView({
  items,
  loading = false,
  sort,
  sortDisabled = false,
  onSortChange,
  onOpenItem,
  onPreviewItem,
  onPrefetchItem,
  selectable = true,
  reserveSelectionSpace = true,
  metadataColumns,
  renderNameDetails,
  renderActions,
  actionsAlwaysVisible = false,
  actionsWidth = 56,
  emptyState,
  ariaLabel = "Drive files",
  loadingAriaLabel = "Loading Drive files",
  scrollX = 744,
}: DriveListViewProps) {
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
    (item: DriveItem) => {
      if (item.type === "folder") {
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
        selectOnly(item.id);
        setPreviewItemId(item.id);
      }
    },
    [clearSelection, onOpenItem, onPreviewItem, selectOnly, selectable],
  );

  const handleRowClick = (event: MouseEvent<HTMLTableRowElement>, item: DriveItem) => {
    if (!selectable) {
      handleActivateItem(item);
      return;
    }

    if (event.detail > 1) {
      return;
    }

    if (selectionMode) {
      toggleItem(item.id);
      return;
    }

    selectOnly(item.id);
  };

  const handleContextSelect = (item: DriveItem) => {
    if (isSelected(item.id)) {
      return;
    }

    if (selectionMode) {
      toggleItem(item.id);
      return;
    }

    selectOnly(item.id);
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

  const resolvedMetadataColumns: DriveListMetadataColumn[] = metadataColumns ?? [
    {
      key: "modified",
      title: "Last modified",
      field: "modified",
      width: 170,
      render: (item) => (
        <span className={classes.metadata}>{formatModifiedDate(item.lastModifiedAt)}</span>
      ),
    },
    {
      key: "type",
      title: "Type",
      field: "type",
      width: 110,
      render: (item) => (
        <span className={classes.metadata}>{item.type === "folder" ? "Folder" : "File"}</span>
      ),
    },
    {
      key: "size",
      title: "File size",
      field: "size",
      width: 120,
      render: (item) => (
        <span className={classes.metadata}>
          {item.type === "folder" ? "—" : formatDriveFileSize(item)}
        </span>
      ),
    },
  ];
  const showSelectionColumn = selectable || reserveSelectionSpace;
  const hasActions = selectable || Boolean(renderActions);

  const columns: TableColumnsType<DriveItem> = [
    ...(showSelectionColumn
      ? [
          {
            key: "selection",
            width: 48,
            className: classes.selectionCell,
            render: (_: unknown, item: DriveItem) =>
              selectable && selectionMode ? (
                <Checkbox
                  checked={isSelected(item.id)}
                  aria-label={`Select ${item.name}`}
                  onClick={(event) => event.stopPropagation()}
                  onChange={() => toggleItem(item.id)}
                />
              ) : null,
          },
        ]
      : []),
    {
      key: "name",
      title: sortableTitle("Name", "name"),
      onHeaderCell: () => headerCellProps("name"),
      render: (_, item) => (
        <DriveItemNameCell item={item} details={renderNameDetails?.(item)} />
      ),
    },
    ...resolvedMetadataColumns.map((column) => ({
      key: column.key,
      title: column.field ? sortableTitle(column.title, column.field) : column.title,
      width: column.width,
      responsive: column.responsive,
      onHeaderCell: column.field ? () => headerCellProps(column.field!) : undefined,
      render: (_: unknown, item: DriveItem) => column.render(item),
    })),
    ...(hasActions
      ? [
          {
            key: "actions",
            title: <span className={classes.visuallyHidden}>Actions</span>,
            width: actionsWidth,
            align: "right" as const,
            className: classes.actionsCell,
            render: (_: unknown, item: DriveItem) => {
              if (renderActions) {
                return (
                  <DriveListActions visible={actionsAlwaysVisible}>
                    {renderActions(item)}
                  </DriveListActions>
                );
              }

              const previewOpen = previewItemId === item.id;
              return (
                <DriveListActions visible={previewOpen}>
                  <FileActions
                    item={item}
                    isPreview={previewOpen}
                    onPreviewChange={(open) => setPreviewItemId(open ? item.id : null)}
                    onOpenItem={() => handleActivateItem(item)}
                  />
                </DriveListActions>
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
      title: sortableTitle("Name", "name"),
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
            width: actionsWidth,
            align: "right" as const,
            className: classes.actionsCell,
            render: () => (
              <div className={classes.skeletonActionCell}>
                <Skeleton.Button
                  active
                  shape="circle"
                  size="small"
                  className={classes.skeletonAction}
                />
              </div>
            ),
          },
        ]
      : []),
  ];

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const rowContext = useMemo<DriveListRowContextValue>(
    () => ({
      itemById,
      selectionMode,
      selectedCount,
      isSelected,
      onOpen: handleActivateItem,
    }),
    [handleActivateItem, itemById, isSelected, selectedCount, selectionMode],
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
    <DriveListTable<DriveItem>
      ariaLabel={ariaLabel}
      rowKey="id"
      columns={columns}
      dataSource={items}
      loading={loading}
      locale={{ emptyText: null }}
      components={selectable ? { body: { row: DriveListRow } } : undefined}
      scrollX={scrollX}
      interactive={interactive}
      rowClassName={(item) => cn(selectable && isSelected(item.id) && classes.selectedRow)}
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
              ...(selectable ? { "aria-selected": isSelected(item.id) } : {}),
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
                item.type === "folder" && onPrefetchItem
                  ? () => onPrefetchItem(item)
                  : undefined,
              onFocus:
                item.type === "folder" && onPrefetchItem
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
