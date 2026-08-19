import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FolderOpenOutlined,
  MoreOutlined,
  ShareAltOutlined,
  StarFilled,
  StarOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { App, Button, Dropdown, type MenuProps } from "antd";
import { type ReactNode, useState } from "react";

import { MoveItemModal } from "@/components/drive/actions/MoveItemModal";
import { RenameItemModal } from "@/components/drive/actions/RenameItemModal";
import { ShareItemModal } from "@/components/drive/actions/ShareItemModal";
import { FilePreviewDialog } from "@/components/file-preview/FilePreviewDialog";
import { useDeleteItem, useDownloadFile, useSetDriveItemStarred } from "@/hooks";
import type { DriveItem } from "@/types/api.types";
import classes from "./FileActions.module.css";


interface FileActionsProps {
  item: DriveItem;
  isPreview?: boolean;
  showQuickActions?: boolean;
  quickActionExtra?: ReactNode;
  onPreviewChange?: (open: boolean) => void;
  onOpenItem?: () => void;
}

type ActionModal = "rename" | "move" | "share" | null;

export default function FileActions({
  item,
  isPreview,
  showQuickActions = false,
  quickActionExtra,
  onPreviewChange,
  onOpenItem,
}: FileActionsProps) {
  const [internalPreviewOpen, setInternalPreviewOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ActionModal>(null);
  const { message, modal } = App.useApp();
  const downloadFile = useDownloadFile();
  const deleteItem = useDeleteItem();
  const setStarred = useSetDriveItemStarred();
  const isControlled = isPreview !== undefined;
  const previewOpen = isControlled ? isPreview : internalPreviewOpen;

  const setPreviewOpen = (open: boolean) => {
    if (!isControlled) setInternalPreviewOpen(open);
    onPreviewChange?.(open);
  };

  const handleOpen = () => {
    if (item.type === "folder") {
      onOpenItem?.();
      return;
    }
    setPreviewOpen(true);
  };

  const handleDownload = () => {
    downloadFile.mutate(
      { fileId: item.id, fallbackName: item.name },
      { onError: (error) => void message.error(error instanceof Error ? error.message : "Unable to download this file.") }
    );
  };

  const confirmDelete = () => {
    modal.confirm({
      title: `Move “${item.name}” to trash?`,
      content: "You can restore this item later from Trash.",
      okText: "Move to trash",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      onOk: async () => {
        try {
          await deleteItem.mutateAsync(item.id);
          void message.success("Item moved to trash");
        } catch (error) {
          void message.error(error instanceof Error ? error.message : "Unable to move this item to trash.");
          throw error;
        }
      },
    });
  };

  const handleSetStarred = () => {
    const starred = !item.isStarred;

    setStarred.mutate(
      { id: item.id, starred },
      {
        onSuccess: () => void message.success(starred ? "Added to Starred" : "Removed from Starred"),
        onError: (error) =>
          void message.error(error instanceof Error ? error.message : "Unable to update Starred."),
      },
    );
  };

  const menuItems: MenuProps["items"] = [
    {
      key: "open",
      icon: item.type === "folder" ? <FolderOpenOutlined /> : <EyeOutlined />,
      label: item.type === "folder" ? "Open" : "Preview",
    },
    ...(item.type === "file"
      ? [{ key: "download", icon: <DownloadOutlined />, label: "Download" }]
      : []),
    {
      key: "starred",
      icon: item.isStarred ? <StarFilled /> : <StarOutlined />,
      label: item.isStarred ? "Remove from Starred" : "Add to Starred",
    },
    { key: "share", icon: <ShareAltOutlined />, label: "Share" },
    { key: "rename", icon: <EditOutlined />, label: "Rename" },
    { key: "move", icon: <SwapOutlined />, label: "Move" },
    { type: "divider" as const },
    { key: "delete", icon: <DeleteOutlined />, label: "Move to trash", danger: true },
  ];

  const handleMenuClick: MenuProps["onClick"] = ({ key, domEvent }) => {
    domEvent.stopPropagation();
    if (key === "open") handleOpen();
    if (key === "download") handleDownload();
    if (key === "starred") handleSetStarred();
    if (key === "share" || key === "rename" || key === "move") setActiveModal(key);
    if (key === "delete") confirmDelete();
  };

  const stopPropagation = (event: React.SyntheticEvent) => event.stopPropagation();

  return (
    <>
      <div
        className={classes.actionBar}
        onPointerDown={stopPropagation}
        onClick={stopPropagation}
        onKeyDown={stopPropagation}
      >
        {showQuickActions && (
          <>
            <Button
              type="text"
              shape="circle"
              className={classes.button}
              aria-label={`Share ${item.name}`}
              title="Share"
              icon={<ShareAltOutlined />}
              onClick={() => setActiveModal("share")}
            />
            {item.type === "file" && (
              <Button
                type="text"
                shape="circle"
                className={classes.button}
                aria-label={`Download ${item.name}`}
                title="Download"
                icon={<DownloadOutlined />}
                loading={downloadFile.isPending}
                onClick={handleDownload}
              />
            )}
            <Button
              type="text"
              shape="circle"
              className={classes.button}
              aria-label={`Rename ${item.name}`}
              title="Rename"
              icon={<EditOutlined />}
              onClick={() => setActiveModal("rename")}
            />
            {quickActionExtra}
          </>
        )}

        <Dropdown
          trigger={["click"]}
          placement="bottomRight"
          menu={{ items: menuItems, onClick: handleMenuClick, className: classes.menu }}
        >
          <Button
            type="text"
            shape="circle"
            className={classes.button}
            aria-label={`Open actions for ${item.name}`}
            icon={<MoreOutlined />}
            loading={downloadFile.isPending || deleteItem.isPending || setStarred.isPending}
            onClick={stopPropagation}
          />
        </Dropdown>
      </div>

      {item.type === "file" && <FilePreviewDialog item={item} open={previewOpen} onOpenChange={setPreviewOpen} />}
      <RenameItemModal
        open={activeModal === "rename"}
        itemId={item.id}
        currentName={item.name}
        expectedMetadataVersion={item.metadataVersion}
        onClose={() => setActiveModal(null)}
      />
      <MoveItemModal
        open={activeModal === "move"}
        itemId={item.id}
        itemName={item.name}
        currentParentId={item.parentId}
        expectedMetadataVersion={item.metadataVersion}
        onClose={() => setActiveModal(null)}
      />
      <ShareItemModal
        open={activeModal === "share"}
        itemId={item.id}
        itemName={item.name}
        onClose={() => setActiveModal(null)}
      />
    </>
  );
}
