import type { DriveSortDirection } from "@/types/api.types";
import type { DriveSortField, DriveSortState } from "@/types/drive.type";

const SORT_FIELDS: readonly DriveSortField[] = ["name", "modified", "type", "size"];
const SORT_DIRECTIONS: readonly DriveSortDirection[] = ["asc", "desc"];

export const DEFAULT_DRIVE_SORT: DriveSortState = {
  field: "name",
  direction: "asc",
};

export function readDriveSortParams(
  searchParams: URLSearchParams,
  fallback: DriveSortState = DEFAULT_DRIVE_SORT,
): DriveSortState {
  const fieldParam = searchParams.get("sort");
  const directionParam = searchParams.get("direction");

  const field = SORT_FIELDS.includes(fieldParam as DriveSortField)
    ? (fieldParam as DriveSortField)
    : fallback.field;
  const direction = SORT_DIRECTIONS.includes(directionParam as DriveSortDirection)
    ? (directionParam as DriveSortDirection)
    : fallback.direction;

  return { field, direction };
}

export function writeDriveSortParams(searchParams: URLSearchParams, sort: DriveSortState) {
  const nextParams = new URLSearchParams(searchParams);
  nextParams.set("sort", sort.field);
  nextParams.set("direction", sort.direction);
  return nextParams;
}

export function createDriveSortSearch(sort: DriveSortState) {
  return writeDriveSortParams(new URLSearchParams(), sort).toString();
}
