import { ArrowDownOutlined, ArrowUpOutlined } from "@ant-design/icons";
import { clsx as cn } from "clsx";

import type { DriveSortField, DriveSortState } from "@/types/drive.type";

import classes from "./DriveListView.module.css";

interface DriveListHeaderProps {
  label: string;
  field: DriveSortField;
  sort: DriveSortState;
  disabled?: boolean;
  onSortChange: (sort: DriveSortState) => void;
}

/**
 * Sort control rendered inside an Ant Design Table header cell.
 * Sorting stays server-driven; the Table must not reorder the current page locally.
 */
export function DriveListHeader({
  label,
  field,
  sort,
  disabled = false,
  onSortChange,
}: DriveListHeaderProps) {
  const active = !disabled && sort.field === field;

  const handleSort = () => {
    if (disabled) {
      return;
    }

    onSortChange({
      field,
      direction: sort.field === field && sort.direction === "asc" ? "desc" : "asc",
    });
  };

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${label}, ${active ? (sort.direction === "asc" ? "ascending" : "descending") : "not sorted"}`}
      className={cn(
        classes.columnSort,
        active && classes.columnSortActive,
        disabled && classes.columnSortDisabled,
      )}
      onClick={handleSort}
    >
      <span className={classes.columnSortLabel}>{label}</span>

      {active &&
        (sort.direction === "asc" ? (
          <ArrowUpOutlined className={classes.columnSortIcon} />
        ) : (
          <ArrowDownOutlined className={classes.columnSortIcon} />
        ))}
    </button>
  );
}
