import { PlusOutlined } from "@ant-design/icons";
import { Button, Popover } from "antd";
import { UploadFileButton } from "./UploadFileButton";
import { UploadFolderButton } from "./UploadFoldersButton";
import { clsx as cn } from "clsx";
import { CreateFolderButton } from "./CreateFolder";
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
      title="Create or upload"
      content={
        <div className={styles.content}>
          <CreateFolderButton parentId={parentId} />
          <UploadFileButton parentId={parentId} />
          <UploadFolderButton parentId={parentId} />
        </div>
      }
    >
      <Button
        type="default"
        className={cn(styles.trigger, compact && styles.compactTrigger, className)}
        aria-label={compact ? "Create or upload" : undefined}
        icon={<PlusOutlined />}
      >
        {compact ? null : "New"}
      </Button>
    </Popover>
  );
};

export default PopoverUpload;
