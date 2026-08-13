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
    key: "updatedAt",
    label: "Last modified",
  },
  {
    key: "sizeBytes",
    label: "File size",
  },
  {
    key: "type",
    label: "Type",
  },
];

export const SORT_LABELS: Record<DriveSortField, string> = {
  name: "Name",
  updatedAt: "Last modified",
  sizeBytes: "File size",
  type: "Type",
};
