import { Empty, Space, Typography } from "antd";
import { clsx as cn } from "clsx";
import { UploadFileButton } from "./UploadFileButton";
import { UploadFolderButton } from "./UploadFoldersButton";
import { CreateFolderButton } from "./CreateFolder";
import classes from "./EmptyFolderState.module.css";


interface EmptyFolderStateProps {
  parentId?: string | null;
  className?: string;
}

export default function EmptyFolderState({ parentId, className }: EmptyFolderStateProps) {
  return (
    <div className={cn(classes.centeredColumn, className ?? "")}>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Space direction="vertical" size={4}>
            <Typography.Text strong>This folder is empty</Typography.Text>
            <Typography.Text type="secondary">
              Upload files or create a new folder to organize your content.
            </Typography.Text>
          </Space>
        }
      >
        <Space wrap className={classes.centeredRow}>
          <CreateFolderButton parentId={parentId} variant="button" />
          <UploadFileButton parentId={parentId} variant="button" />
          <UploadFolderButton parentId={parentId} variant="button" />
        </Space>
      </Empty>
    </div>
  );
}
