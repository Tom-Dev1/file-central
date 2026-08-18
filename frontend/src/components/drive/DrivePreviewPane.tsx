import { useEffect } from "react";
import {
  CloseOutlined,
  EyeInvisibleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Button, Spin } from "antd";

import { FilePreviewContent } from "@/components/file-preview/FilePreviewContent";
import { ThemedSvgIcon } from "@/components/theme/ThemedSvgIcon";
import { formatDriveFileSize, formatModifiedDate } from "@/constants/file-constants";
import { useFilePreviewLink } from "@/hooks/useFiles";
import type { DriveItem } from "@/types/api.types";
import { getDriveItemIcon } from "@/utils/file-utils";
import classes from "./DrivePreviewPane.module.css";

interface DrivePreviewPaneProps {
  item: DriveItem | null;
  selectedCount: number;
  onClose: () => void;
}

export function DrivePreviewPane({ item, selectedCount, onClose }: DrivePreviewPaneProps) {
  const previewMutation = useFilePreviewLink();
  const { mutate, reset, data, isPending, isError } = previewMutation;
  const itemId = item?.id;
  const itemType = item?.type;

  useEffect(() => {
    reset();

    if (itemId && itemType === "file") mutate(itemId);
  }, [itemId, itemType, mutate, reset]);

  const handleRetry = () => {
    if (!item || item.type !== "file") return;
    reset();
    mutate(item.id);
  };

  return (
    <aside className={classes.pane} aria-label="Preview pane">
      <header className={classes.header}>
        <span className={classes.headerTitle}>Preview</span>
        <Button
          type="text"
          shape="circle"
          aria-label="Close preview pane"
          icon={<CloseOutlined />}
          onClick={onClose}
        />
      </header>

      {!item ? (
        <div className={classes.empty}>
          <EyeInvisibleOutlined className={classes.emptyIcon} />
          <div className={classes.emptyTitle}>
            {selectedCount > 1 ? `${selectedCount} items selected` : "No item selected"}
          </div>
          <div className={classes.emptyDescription}>
            {selectedCount > 1
              ? "Select one file or folder to see its preview."
              : "Select a file or folder from the list to preview it here."}
          </div>
        </div>
      ) : (
        <div className={classes.content}>
          <div className={classes.itemHeader}>
            <ThemedSvgIcon src={getDriveItemIcon(item)} size={28} className={classes.itemIcon} />
            <div className={classes.itemName} title={item.name}>
              {item.name}
            </div>
          </div>

          <div className={classes.previewStage}>
            {item.type === "folder" ? (
              <div className={classes.folderPreview}>
                <ThemedSvgIcon src={getDriveItemIcon(item)} size={112} className={classes.folderIcon} />
                <span>{item.childCount === null ? "Folder" : `${item.childCount} ${item.childCount === 1 ? "item" : "items"}`}</span>
              </div>
            ) : isPending ? (
              <div className={classes.centeredState}>
                <Spin size="large" description="Preparing preview..." />
              </div>
            ) : isError ? (
              <div className={classes.centeredState}>
                <div className={classes.errorTitle}>Unable to open preview</div>
                <div className={classes.errorDescription}>The preview link could not be created.</div>
                <Button icon={<ReloadOutlined />} onClick={handleRetry}>
                  Try again
                </Button>
              </div>
            ) : data ? (
              <FilePreviewContent preview={data} fileName={item.name} />
            ) : (
              <div className={classes.centeredState}>No preview data is available.</div>
            )}
          </div>

          <dl className={classes.details}>
            <div className={classes.detailRow}>
              <dt>Type</dt>
              <dd>{item.type === "folder" ? "File folder" : item.mimeType ?? item.extension ?? "File"}</dd>
            </div>
            <div className={classes.detailRow}>
              <dt>Modified</dt>
              <dd>{formatModifiedDate(item.lastModifiedAt)}</dd>
            </div>
            <div className={classes.detailRow}>
              <dt>{item.type === "folder" ? "Contains" : "Size"}</dt>
              <dd>
                {item.type === "folder"
                  ? item.childCount === null
                    ? "Unknown"
                    : `${item.childCount} ${item.childCount === 1 ? "item" : "items"}`
                  : formatDriveFileSize(item)}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </aside>
  );
}
