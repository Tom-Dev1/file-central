import { Button, Dropdown, type MenuProps } from "antd";
import type { DriveItem } from "@/types/api.types";
import { FolderOpen, LucideDelete, MoreVertical, SendToBack, Share2, Star } from "lucide-react";
import classes from "./test.module.css";


interface FileActionsProps {
  item: DriveItem;
  onPreview?: () => void;
  onOpenFolder?: () => void;
}

export default function FileActions({ item, onPreview, onOpenFolder }: FileActionsProps) {
  const items: MenuProps["items"] = [
    { key: "open", icon: <FolderOpen className={classes.icon} />, label: item.type === "folder" ? "Open" : "Preview" },
    { key: "share", icon: <Share2 className={classes.icon2} />, label: "Share with", disabled: true },
    { key: "star", icon: <Star className={classes.icon3} />, label: "Add to starred", disabled: true },
    { key: "rename", icon: <SendToBack className={classes.icon4} />, label: "Rename", disabled: true },
    { type: "divider" },
    { key: "delete", icon: <LucideDelete className={classes.icon5} />, label: "Delete", danger: true, disabled: true },
  ];

  const handleClick: MenuProps["onClick"] = ({ key }) => {
    if (key !== "open") return;
    if (item.type === "folder") onOpenFolder?.();
    else onPreview?.();
  };

  return (
    <Dropdown menu={{ items, onClick: handleClick }} trigger={["click"]} placement="bottomRight">
      <Button type="text" shape="circle" size="small" aria-label={`Open actions for ${item.name}`} icon={<MoreVertical className={classes.icon6} />} />
    </Dropdown>
  );
}
