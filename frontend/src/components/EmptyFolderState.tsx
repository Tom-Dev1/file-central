import { Empty, Space, Typography } from "antd";
import { clsx as cn } from "clsx";
import { CreateFolderButton } from "./CreateFolder";
import { UploadFileButton } from "./UploadFileButton";
import { UploadFolderButton } from "./UploadFoldersButton";
import classes from "./EmptyFolderState.module.css";

interface EmptyFolderStateProps {
  parentId?: string | null;
  className?: string;
}

export default function EmptyFolderState({
  parentId,
  className,
}: EmptyFolderStateProps) {
  return (
    <div className={cn(classes.centeredColumn, className)}>
      <Empty
        classNames={{
          root: classes.empty,
          image: classes.image,
          description: classes.description,
          footer: classes.footer,
        }}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Space orientation="vertical" size={4} className={classes.copy}>
            <Typography.Text strong className={classes.title}>
              This folder is empty
            </Typography.Text>
            <Typography.Text type="secondary" className={classes.hint}>
              Upload files or create a new folder to organize your content.
            </Typography.Text>
          </Space>
        }
      >
        <Space wrap size={[8, 8]} className={classes.centeredRow}>
          <CreateFolderButton parentId={parentId} variant="button" />
          <UploadFileButton parentId={parentId} variant="button" />
          <UploadFolderButton parentId={parentId} variant="button" />
        </Space>
      </Empty>
    </div>
  );
}