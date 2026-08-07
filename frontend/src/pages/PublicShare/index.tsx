import { DownloadOutlined, FileOutlined, ReloadOutlined } from "@ant-design/icons";
import { App, Button, Card, Descriptions, Result, Skeleton, Tag, Typography } from "antd";
import { useParams } from "react-router-dom";

import { ThemedSvgIcon } from "@/components/theme/ThemedSvgIcon";
import { formatFileSize, formatModifiedDate } from "@/constants/file-constants";
import { useDownloadPublicShare, usePublicShareMetadata } from "@/hooks";
import type { SharePermission } from "@/types/api.types";
import { getDriveItemIcon } from "@/utils/file-utils";

const permissionLabels: Record<SharePermission, string> = {
  view: "View only",
  download: "Download allowed",
  edit: "Edit access",
};

export default function PublicSharePage() {
  const { token = "" } = useParams<{ token: string }>();
  const { message } = App.useApp();
  const metadataQuery = usePublicShareMetadata(token);
  const downloadShare = useDownloadPublicShare();
  const metadata = metadataQuery.data;
  const canDownload = metadata?.item.type === "file" && metadata.permission !== "view";

  const handleDownload = () => {
    if (!metadata) return;
    downloadShare.mutate(
      { token, fallbackName: metadata.item.name },
      { onError: (error) => void message.error(error instanceof Error ? error.message : "Unable to download this file.") }
    );
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-3xl items-center justify-center px-4 py-12 sm:px-6">
      {metadataQuery.isLoading ? (
        <Card className="w-full"><Skeleton active avatar paragraph={{ rows: 5 }} /></Card>
      ) : metadataQuery.isError || !metadata ? (
        <Card className="w-full">
          <Result
            status="error"
            title="This shared link is unavailable"
            subTitle="It may be invalid, expired, or revoked by its owner."
            extra={<Button icon={<ReloadOutlined />} onClick={() => void metadataQuery.refetch()}>Try again</Button>}
          />
        </Card>
      ) : (
        <Card className="w-full" styles={{ body: { padding: 0 } }}>
          <div className="flex flex-col items-center border-b p-6 text-center sm:p-8">
            <span className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10">
              {metadata.item ? <ThemedSvgIcon src={getDriveItemIcon(metadata.item)} className="size-9 bg-primary" /> : <FileOutlined />}
            </span>
            <Typography.Title level={3} ellipsis={{ tooltip: metadata.item.name }} className="!mb-2 max-w-full">
              {metadata.item.name}
            </Typography.Title>
            <Tag color="blue">{permissionLabels[metadata.permission]}</Tag>
          </div>

          <div className="p-6 sm:p-8">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Type">{metadata.item.type === "folder" ? "Folder" : metadata.item.mimeType ?? "File"}</Descriptions.Item>
              <Descriptions.Item label="Size">{metadata.item.type === "folder" ? "—" : formatFileSize(Number(metadata.item.sizeBytes ?? 0))}</Descriptions.Item>
              <Descriptions.Item label="Last modified">{formatModifiedDate(metadata.item.updatedAt)}</Descriptions.Item>
              <Descriptions.Item label="Access">{permissionLabels[metadata.permission]}</Descriptions.Item>
            </Descriptions>

            <Typography.Paragraph type="secondary" className="!mb-5 !mt-5 !text-sm">
              This item was shared through File Central. Public preview is not available on shared links.
            </Typography.Paragraph>

            {canDownload ? (
              <Button type="primary" block icon={<DownloadOutlined />} loading={downloadShare.isPending} onClick={handleDownload}>
                Download file
              </Button>
            ) : (
              <Result
                className="!p-0"
                status="info"
                title={metadata.item.type === "folder" ? "Folder access" : "View-only access"}
                subTitle={metadata.item.type === "folder" ? "Open this link from a signed-in shared workspace to browse the folder." : "The owner has not enabled downloads for this link."}
              />
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
