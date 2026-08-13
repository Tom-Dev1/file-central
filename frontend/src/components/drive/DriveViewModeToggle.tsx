import { AppstoreOutlined, UnorderedListOutlined } from "@ant-design/icons";
import { Segmented } from "antd";
import classes from "./DriveViewModeToggle.module.css";

type DriveViewMode = "list" | "grid";

type Props = {
  value: DriveViewMode;
  onChange: (value: DriveViewMode) => void;
};

export function DriveViewModeToggle({ value, onChange }: Props) {
  return (
    <Segmented
      size="large"
      value={value}
      aria-label="Choose file view"
      classNames={{
        root: classes.root,
        item: classes.item,
        label: classes.label,
        icon: classes.icon,
      }}
      shape="round"
      options={[
        {
          value: "list",
          icon: <UnorderedListOutlined />,
          tooltip: "List view",
        },
        {
          value: "grid",
          icon: <AppstoreOutlined />,
          tooltip: "Grid view",
        },
      ]}
      onChange={(nextValue) => onChange(nextValue as DriveViewMode)}
    />
  );
}
