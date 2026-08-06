import { Empty, Space, Typography } from "antd";
import { UploadFileButton } from "./UploadFileButton";
import { UploadFolderButton } from "./UploadFoldersButton";
import { CreateFolderButton } from "./CreateFolder";

interface EmptyFolderStateProps {
  parentId?: string | null;
  className?: string;
}

export default function EmptyFolderState({ parentId, className }: EmptyFolderStateProps) {
  return (
    <div className={`flex min-h-[400px] flex-col items-center justify-center px-4 text-center ${className ?? ""}`}>
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
        <Space wrap className="justify-center">
          <CreateFolderButton parentId={parentId} variant="button" />
          <UploadFileButton parentId={parentId} variant="button" />
          <UploadFolderButton parentId={parentId} variant="button" />
        </Space>
      </Empty>
    </div>
  );
}
