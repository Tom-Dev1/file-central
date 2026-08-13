import type { DriveSortField } from "@/types/drive.type";
import type { MenuProps } from "antd";

export const TYPE_FILTER_ITEMS: MenuProps["items"] = [
  {
    key: "all",
    label: "All types",
  },
  {
    key: "folder",
    label: "Folders",
  },
  {
    key: "file",
    label: "Files",
  },
];

export const MODIFIED_FILTER_ITEMS: MenuProps["items"] = [
  {
    key: "any",
    label: "Any time",
  },
  {
    key: "today",
    label: "Today",
  },
  {
    key: "last7Days",
    label: "Last 7 days",
  },
  {
    key: "last30Days",
    label: "Last 30 days",
  },
];

export const SORT_ITEMS: MenuProps["items"] = [
  {
    key: "name",
    label: "Name",
  },
  {
    key: "modified",
    label: "Last modified",
  },
  {
    key: "type",
    label: "Type",
  },
  {
    key: "size",
    label: "File size",
  },
];

export const SORT_LABELS: Record<DriveSortField, string> = {
  name: "Name",
  modified: "Last modified",
  type: "Type",
  size: "File size",
};
