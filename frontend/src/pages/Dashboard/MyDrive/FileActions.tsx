import { FilePreviewDialog } from "@/components/file-preview/FilePreviewDialog";
import type { DriveItem } from "@/types/api.types";
import { FolderOpen, LucideDelete, MoreVertical, SendToBack, Share2, Star } from "lucide-react";
import { Button, Dropdown, type MenuProps } from "antd";
import { useState } from "react";

interface FileActionsProps {
  item: DriveItem;
  isPreview?: boolean;
  onPreviewChange?: (open: boolean) => void;
  onOpenItem?: () => void;
}

export default function FileActions({ item, isPreview, onPreviewChange, onOpenItem }: FileActionsProps) {
  const [internalPreviewOpen, setInternalPreviewOpen] = useState(false);

  const isControlled = isPreview !== undefined;

  const previewOpen = isControlled ? isPreview : internalPreviewOpen;

  const setPreviewOpen = (open: boolean) => {
    if (!isControlled) {
      setInternalPreviewOpen(open);
    }

    onPreviewChange?.(open);
  };

  const handleOpen = () => {
    if (item.type === "folder") {
      onOpenItem?.();
      return;
    }

    setPreviewOpen(true);
  };

  const menuItems: MenuProps["items"] = [
    {
      key: "open",
      icon: <FolderOpen className="size-4" />,
      label: item.type === "folder" ? "Open" : "Preview",
    },
    {
      key: "share",
      icon: <Share2 className="size-4" />,
      label: "Share with",
    },
    {
      key: "star",
      icon: <Star className="size-4" />,
      label: "Add to starred",
    },
    {
      key: "rename",
      icon: <SendToBack className="size-4" />,
      label: "Rename",
    },
    {
      type: "divider",
    },
    {
      key: "delete",
      icon: <LucideDelete className="size-4" />,
      label: "Delete",
      danger: true,
    },
  ];

  const handleMenuClick: MenuProps["onClick"] = ({ key, domEvent }) => {
    domEvent.stopPropagation();

    switch (key) {
      case "open":
        handleOpen();
        break;

      case "share":
        break;

      case "star":
        break;

      case "rename":
        break;

      case "delete":
        break;

      default:
        break;
    }
  };

  const stopPropagation = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  return (
    <>
      <div onPointerDown={stopPropagation} onClick={stopPropagation} onKeyDown={stopPropagation}>
        <Dropdown
          trigger={["click"]}
          placement="bottomRight"
          menu={{
            items: menuItems,
            onClick: handleMenuClick,
            className: "min-w-52",
          }}
        >
          <Button
            type="text"
            shape="circle"
            className="flex size-8 items-center justify-center"
            aria-label={`Open actions for ${item.name}`}
            icon={<MoreVertical className="size-4" />}
            onClick={stopPropagation}
          />
        </Dropdown>
      </div>

      {item.type === "file" && <FilePreviewDialog item={item} open={previewOpen} onOpenChange={setPreviewOpen} />}
    </>
  );
}
