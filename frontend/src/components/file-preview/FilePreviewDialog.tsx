import { DownloadOutlined, ExportOutlined, ReloadOutlined } from "@ant-design/icons";
import { App, Button, Modal, Result, Space, Spin, Typography } from "antd";
import { useEffect } from "react";

import { useDownloadFile, useFilePreviewLink } from "@/hooks/useFiles";
import type { DriveItem } from "@/types/api.types";

import { FilePreviewContent } from "./FilePreviewContent";
import classes from "./FilePreviewDialog.module.css";


interface FilePreviewDialogProps {
  item: DriveItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allowDownload?: boolean;
}

export function FilePreviewDialog({ item, open, onOpenChange, allowDownload = true }: FilePreviewDialogProps) {
  const { message } = App.useApp();
  const previewMutation = useFilePreviewLink();
  const downloadMutation = useDownloadFile();
  const { mutate, reset, data, isPending, isError } = previewMutation;
  const { reset: resetDownload } = downloadMutation;

  useEffect(() => {
    if (!open) {
      reset();
      resetDownload();
      return;
    }

    mutate(item.id);
  }, [item.id, mutate, open, reset, resetDownload]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);

    if (!nextOpen) {
      reset();
      resetDownload();
    }
  };

  const handleRetry = () => {
    reset();
    mutate(item.id);
  };

  const handleDownload = () => {
    downloadMutation.mutate(
      { fileId: item.id, fallbackName: item.name },
      {
        onError: (error) => {
          void message.error(error instanceof Error ? error.message : "Unable to download this file.");
        },
      }
    );
  };

  const modalTitle = (
    <div className={classes.spreadRow}>
      <div className={classes.div}>
        <Typography.Title level={5} ellipsis={{ tooltip: item.name }} className={classes.title}>
          {item.name}
        </Typography.Title>
        <Typography.Text type="secondary" ellipsis className={classes.text}>
          {item.mimeType ?? "Unknown file type"}
        </Typography.Text>
      </div>

      <Space size={4} className={classes.space}>
        {data?.url && (
          <Button
            type="text"
            shape="circle"
            aria-label="Open file in a new tab"
            icon={<ExportOutlined />}
            onClick={() => window.open(data.url, "_blank", "noopener,noreferrer")}
          />
        )}
        {allowDownload && (
          <Button
            type="text"
            shape="circle"
            aria-label={`Download ${item.name}`}
            loading={downloadMutation.isPending}
            icon={<DownloadOutlined />}
            onClick={handleDownload}
          />
        )}
      </Space>
    </div>
  );

  return (
    <Modal
      open={open}
      title={modalTitle}
      footer={null}
      width="95vw"
      centered
      destroyOnHidden
      onCancel={() => handleOpenChange(false)}
      styles={{
        container: { padding: 0, overflow: "hidden" },
        header: { marginBottom: 0, padding: "16px 52px 16px 20px", borderBottom: "1px solid var(--border)" },
        body: { height: "calc(90vh - 73px)", overflow: "hidden" },
      }}
    >
      {isPending ? (
        <div className={classes.centeredColumn}>
          <Spin size="large" />
          <Typography.Text type="secondary">Preparing preview...</Typography.Text>
        </div>
      ) : isError ? (
        <div className={classes.centeredRow}>
          <Result
            status="error"
            title="Unable to open preview"
            subTitle="The preview link could not be created. Please try again."
            extra={
              <Button icon={<ReloadOutlined />} onClick={handleRetry}>
                Try again
              </Button>
            }
          />
        </div>
      ) : data ? (
        <FilePreviewContent
          preview={data}
          fileName={item.name}
        />
      ) : (
        <div className={classes.centeredRow2}>
          <Result status="info" title="No preview data is available" />
        </div>
      )}
    </Modal>
  );
}
