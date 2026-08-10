import { DownloadOutlined, ExportOutlined, FileUnknownOutlined } from "@ant-design/icons";
import { Button, Space, Typography } from "antd";

import type { PreviewLinkResponse } from "@/types/file-preview.types";
import { resolvePreviewKind } from "@/utils/resolve-preview-kind";
import classes from "./FilePreviewContent.module.css";


interface FilePreviewContentProps {
  preview: PreviewLinkResponse;
  fileName: string;
  allowDownload?: boolean;
  downloadPending?: boolean;
  onDownload?: () => void;
}

export function FilePreviewContent({
  preview,
  fileName,
  allowDownload = true,
  downloadPending = false,
  onDownload,
}: FilePreviewContentProps) {
  switch (resolvePreviewKind(fileName)) {
    case "image":
      return (
        <div className={classes.centeredRow}>
          <img src={preview.url} alt={fileName} className={classes.imgPreview} />
        </div>
      );

    case "pdf":
      return <iframe src={preview.url} title={fileName} className={classes.iframePreview} />;

    case "video":
      return (
        <div className={classes.centeredRow2}>
          <video src={preview.url} controls preload="metadata" className={classes.videoPreview} />
        </div>
      );

    case "audio":
      return (
        <div className={classes.centeredRow3}>
          <div className={classes.fullWidth}>
            <Typography.Text strong ellipsis={{ tooltip: fileName }} className={classes.text}>
              {fileName}
            </Typography.Text>
            <audio src={preview.url} controls preload="metadata" className={classes.audioPreview} />
          </div>
        </div>
      );

    case "text":
      return <iframe src={preview.url} title={fileName} className={classes.iframePreview} />;

    default:
      return (
        <div className={classes.centeredRow4}>
          <div className={classes.div}>
            <FileUnknownOutlined className={classes.icon} />
            <Typography.Title level={4} className={classes.title}>
              Preview is not available
            </Typography.Title>
            <Typography.Paragraph type="secondary">
              This file type cannot be previewed in the browser.
            </Typography.Paragraph>
            <Space wrap className={classes.centeredRow5}>
              <Button
                icon={<ExportOutlined />}
                onClick={() => window.open(preview.url, "_blank", "noopener,noreferrer")}
              >
                Open file
              </Button>
              {allowDownload && (
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  loading={downloadPending}
                  onClick={onDownload}
                >
                  Download
                </Button>
              )}
            </Space>
          </div>
        </div>
      );
  }
}
