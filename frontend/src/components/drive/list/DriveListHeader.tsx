import { ArrowDownOutlined, ArrowUpOutlined } from "@ant-design/icons";
import { clsx as cn } from "clsx";

import type { DriveSortField, DriveSortState } from "@/types/drive.type";

import classes from "./DriveListView.module.css";

interface DriveListHeaderProps {
  sort: DriveSortState;

  disabled?: boolean;

  onSortChange: (sort: DriveSortState) => void;
}

export function DriveListHeader({ sort, disabled = false, onSortChange }: DriveListHeaderProps) {
  const handleSort = (field: DriveSortField) => {
    if (disabled) {
      return;
    }
    onSortChange({
      field,
      direction:
        sort.field === field && sort.direction === "asc" ? "desc" : "asc",
    });
  };

  return (
    <div role="row" className={classes.header}>
      <div role="columnheader" className={classes.selectionHeader} />

      <SortableColumn
        label="Name"
        field="name"
        sort={sort}
        disabled={disabled}
        onSort={handleSort}
      />

      <SortableColumn
        label="Last modified"
        field="modified"
        sort={sort}
        disabled={disabled}
        onSort={handleSort}
      />

      <SortableColumn
        label="Type"
        field="type"
        sort={sort}
        disabled={disabled}
        onSort={handleSort}
      />

      <SortableColumn
        label="File size"
        field="size"
        sort={sort}
        disabled={disabled}
        onSort={handleSort}
      />

      <div role="columnheader" aria-label="Actions" className={classes.actionsHeader} />
    </div>
  );
}

interface SortableColumnProps {
  label: string;

  field: DriveSortField;

  sort: DriveSortState;

  disabled: boolean;

  onSort: (field: DriveSortField) => void;
}

function SortableColumn({ label, field, sort, disabled, onSort }: SortableColumnProps) {
  const active = !disabled && sort.field === field;

  return (
    <div
      role="columnheader"
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
      className={classes.columnHeader}
    >
      <button
        type="button"
        disabled={disabled}
        aria-label={`${label}, ${active ? (sort.direction === "asc" ? "ascending" : "descending") : "not sorted"}`}
        aria-disabled={disabled || undefined}
        className={cn(
          classes.columnSort,
          active && classes.columnSortActive,
          disabled && classes.columnSortDisabled,
        )}
        onClick={() => onSort(field)}
      >
        <span className={classes.columnSortLabel}>{label}</span>

        {active &&
          (sort.direction === "asc" ? (
            <ArrowUpOutlined className={classes.columnSortIcon} />
          ) : (
            <ArrowDownOutlined className={classes.columnSortIcon} />
          ))}
      </button>
    </div>
  );
}
