import { Empty, Typography } from "antd";
import { UploadFileButton } from "@/components/UploadFileButton";
import classes from "./EmptyState.module.css";


export default function EmptyState() {
  return (
    <div className={classes.centeredRow}>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <div>
            <Typography.Text strong>No files found</Typography.Text>
            <Typography.Paragraph type="secondary" className={classes.paragraph}>
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
