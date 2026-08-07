import { DownloadOutlined, ExportOutlined, FileUnknownOutlined } from "@ant-design/icons";
import { Button, Space, Typography } from "antd";

import type { PreviewLinkResponse } from "@/types/file-preview.types";
import { resolvePreviewKind } from "@/utils/resolve-preview-kind";

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
        <div className="flex size-full items-center justify-center overflow-auto bg-muted/20 p-6">
          <img src={preview.url} alt={fileName} className="max-h-full max-w-full object-contain" />
        </div>
      );

    case "pdf":
      return <iframe src={preview.url} title={fileName} className="size-full border-0 bg-background" />;

    case "video":
      return (
        <div className="flex size-full items-center justify-center bg-black p-4">
          <video src={preview.url} controls preload="metadata" className="max-h-full max-w-full" />
        </div>
      );

    case "audio":
      return (
        <div className="flex size-full items-center justify-center bg-muted/20 p-8">
          <div className="w-full max-w-xl rounded-xl border bg-card p-6">
            <Typography.Text strong ellipsis={{ tooltip: fileName }} className="mb-4 block text-center">
              {fileName}
            </Typography.Text>
            <audio src={preview.url} controls preload="metadata" className="w-full" />
          </div>
        </div>
      );

    case "text":
      return <iframe src={preview.url} title={fileName} className="size-full border-0 bg-background" />;

    default:
      return (
        <div className="flex size-full items-center justify-center overflow-auto p-6">
          <div className="max-w-md text-center">
            <FileUnknownOutlined className="text-5xl text-muted-foreground" />
            <Typography.Title level={4} className="mt-4!">
              Preview is not available
            </Typography.Title>
            <Typography.Paragraph type="secondary">
              This file type cannot be previewed in the browser.
            </Typography.Paragraph>
            <Space wrap className="justify-center">
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
