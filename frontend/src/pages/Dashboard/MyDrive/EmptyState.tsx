import { Empty, Typography } from "antd";
import { UploadFileButton } from "@/components/UploadFileButton";

export default function EmptyState() {
  return (
    <div className="flex min-h-80 items-center justify-center px-6 text-center">
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <div>
            <Typography.Text strong>No files found</Typography.Text>
            <Typography.Paragraph type="secondary" className="mb-0 mt-1 max-w-sm">
              Try changing your search query or upload a new file.
            </Typography.Paragraph>
          </div>
        }
      >
        <UploadFileButton variant="button" />
      </Empty>
    </div>
  );
}
