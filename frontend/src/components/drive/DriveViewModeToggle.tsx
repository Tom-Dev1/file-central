import { AppstoreOutlined, EyeOutlined, UnorderedListOutlined } from "@ant-design/icons";
import { Button, Segmented } from "antd";
import classes from "./DriveViewModeToggle.module.css";

type DriveViewMode = "list" | "grid";

type Props = {
  value: DriveViewMode;
  onChange: (value: DriveViewMode) => void;
  previewOpen: boolean;
  onPreviewOpenChange: (open: boolean) => void;
};

export function DriveViewModeToggle({ value, onChange, previewOpen, onPreviewOpenChange }: Props) {
  return (
    <div className={classes.controls}>
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

      <Button
        color={previewOpen ? "primary" : "default"}
        variant={previewOpen ? "solid" : "outlined"}
        aria-label={previewOpen ? "Close preview pane" : "Open preview pane"}
        aria-pressed={previewOpen}
        icon={<EyeOutlined />}
        className={classes.previewButton}
        onClick={() => onPreviewOpenChange(!previewOpen)}
      >
        Preview
      </Button>
    </div>
  );
}
