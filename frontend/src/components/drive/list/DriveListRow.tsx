import { useContext, type HTMLAttributes, type Key } from "react";

import {
  DeleteOutlined,
  EditOutlined,
  FolderOpenOutlined,
  LinkOutlined,
  MoreOutlined,
  ShareAltOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { Dropdown, type MenuProps } from "antd";

import { DriveListRowContext } from "./DriveListRowContext";

import classes from "./DriveListView.module.css";

type DriveListRowProps = HTMLAttributes<HTMLTableRowElement> & {
  "data-row-key"?: Key;
};

/**
 * Keeps the row context menu while letting Ant Design Table own the row and cells.
 * Dropdown clones this real <tr>; it does not introduce a div inside <tbody>.
 */
export function DriveListRow(rowProps: DriveListRowProps) {
  const context = useContext(DriveListRowContext);
  const rowKey = String(rowProps["data-row-key"]);
  const item = context?.itemByRowKey.get(rowKey);

  if (!context || !item) {
    return <tr {...rowProps} />;
  }

  const selected = context.isSelected(item.selectionId);
  const contextSelectionCount = selected
    ? context.selectedCount
    : context.selectionMode
      ? context.selectedCount + 1
      : 1;
  const singleTarget = contextSelectionCount === 1;

  const menuItems: MenuProps["items"] = [
    {
      key: "open",
      icon: <FolderOpenOutlined />,
      label: item.type === "folder" ? "Open" : "Preview",
      disabled: !singleTarget,
    },
    { type: "divider" },
    {
      key: "share",
      icon: <ShareAltOutlined />,
      label: "Share",
      disabled: true,
    },
    ...(singleTarget
      ? [
          {
            key: "copy-link",
            icon: <LinkOutlined />,
            label: "Copy link",
            disabled: true,
          } satisfies NonNullable<MenuProps["items"]>[number],
        ]
      : []),
    {
      key: "move",
      icon: <SwapOutlined />,
      label: "Move",
      disabled: true,
    },
    ...(singleTarget
      ? [
          {
            key: "rename",
            icon: <EditOutlined />,
            label: "Rename",
            disabled: true,
          } satisfies NonNullable<MenuProps["items"]>[number],
        ]
      : []),
    { type: "divider" },
    {
      key: "trash",
      icon: <DeleteOutlined />,
      label: "Move to Trash",
      danger: true,
      disabled: true,
    },
    {
      key: "more",
      icon: <MoreOutlined />,
      label: "More actions",
      disabled: true,
    },
  ];

  const handleMenuClick: MenuProps["onClick"] = ({ key, domEvent }) => {
    domEvent.stopPropagation();

    if (key === "open") {
      context.onOpen(rowKey);
    }
  };

  return (
    <Dropdown
      trigger={["contextMenu"]}
      menu={{ items: menuItems, onClick: handleMenuClick }}
      classNames={{ root: classes.contextMenu }}
    >
      <tr {...rowProps} />
    </Dropdown>
  );
}
