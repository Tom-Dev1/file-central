import { ArrowDownOutlined, ArrowUpOutlined } from "@ant-design/icons";
import { clsx as cn } from "clsx";

import type { DriveSortField, DriveSortState } from "@/types/drive.type";

import classes from "./DriveListView.module.css";

interface DriveListHeaderProps {
  sort: DriveSortState;

  onSortChange: (sort: DriveSortState) => void;
}

export function DriveListHeader({ sort, onSortChange }: DriveListHeaderProps) {
  const handleSort = (field: DriveSortField) => {
    onSortChange({
      ...sort,
      field,
      direction: sort.field === field && sort.direction === "asc" ? "desc" : "asc",
    });
  };

  return (
    <div role="row" className={classes.header}>
      <div role="columnheader" className={classes.selectionHeader} />

      <SortableColumn label="Name" field="name" sort={sort} onSort={handleSort} />

      <SortableColumn label="Last modified" field="updatedAt" sort={sort} onSort={handleSort} />

      <SortableColumn label="File size" field="sizeBytes" sort={sort} onSort={handleSort} />

      <div role="columnheader" aria-label="Actions" className={classes.actionsHeader} />
    </div>
  );
}

interface SortableColumnProps {
  label: string;

  field: DriveSortField;

  sort: DriveSortState;

  onSort: (field: DriveSortField) => void;
}

function SortableColumn({ label, field, sort, onSort }: SortableColumnProps) {
  const active = sort.field === field;

  return (
    <div
      role="columnheader"
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
      className={classes.columnHeader}
    >
      <div className={cn(classes.columnSort, active && classes.columnSortActive)} onClick={() => onSort(field)}>
        <span className={classes.columnSortLabel}>{label}</span>

        {active &&
          (sort.direction === "asc" ? (
            <ArrowUpOutlined className={classes.columnSortIcon} />
          ) : (
            <ArrowDownOutlined className={classes.columnSortIcon} />
          ))}
      </div>
    </div>
  );
}
