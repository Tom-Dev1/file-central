import { PlusOutlined } from "@ant-design/icons";
import { Button, Popover, Tooltip } from "antd";
import { clsx as cn } from "clsx";

import { CreateFolderButton } from "./CreateFolder";
import { UploadFileButton } from "./UploadFileButton";
import { UploadFolderButton } from "./UploadFoldersButton";

import styles from "./PopoverUpload.module.css";

interface IPopoverUpload {
  parentId?: string | null;
  className?: string;
  compact?: boolean;
}

const PopoverUpload = ({ parentId, className, compact = false }: IPopoverUpload) => {
  return (
    <Popover
      trigger="click"
      placement="bottomLeft"
      arrow={false}
      classNames={{
        root: styles.popoverRoot,
      }}
      content={
        <div className={styles.content} role="menu" aria-label="Create or upload">
          <div className={styles.actionItem}>
            <CreateFolderButton parentId={parentId} />
          </div>

          <div className={styles.divider} />

          <div className={styles.actionItem}>
            <UploadFileButton parentId={parentId} />
          </div>

          <div className={styles.actionItem}>
            <UploadFolderButton parentId={parentId} />
          </div>
        </div>
      }
    >
      <Tooltip title="New files">
        <Button
          variant={compact ? "text" : "text"}
          shape={compact ? "circle" : "circle"}
          className={cn(styles.trigger, compact && styles.compactTrigger, className)}
          aria-label={compact ? "Create or upload" : undefined}
          icon={<PlusOutlined />}
        >
          {!compact && "New"}
        </Button>
      </Tooltip>
    </Popover>
  );
};

export default PopoverUpload;
