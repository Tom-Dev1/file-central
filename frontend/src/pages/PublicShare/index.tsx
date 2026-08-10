import { DownloadOutlined, FileOutlined, ReloadOutlined } from "@ant-design/icons";
import { App, Button, Card, Descriptions, Result, Skeleton, Tag, Typography } from "antd";
import { useParams } from "react-router-dom";

import { ThemedSvgIcon } from "@/components/theme/ThemedSvgIcon";
import { formatFileSize, formatModifiedDate } from "@/constants/file-constants";
import { useDownloadPublicShare, usePublicShareMetadata } from "@/hooks";
import type { SharePermission } from "@/types/api.types";
import { getDriveItemIcon } from "@/utils/file-utils";
import classes from "./index.module.css";


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
    <div className={classes.centeredRow}>
      {metadataQuery.isLoading ? (
        <Card className={classes.card}><Skeleton active avatar paragraph={{ rows: 5 }} /></Card>
      ) : metadataQuery.isError || !metadata ? (
        <Card className={classes.card}>
          <Result
            status="error"
            title="This shared link is unavailable"
            subTitle="It may be invalid, expired, or revoked by its owner."
            extra={<Button icon={<ReloadOutlined />} onClick={() => void metadataQuery.refetch()}>Try again</Button>}
          />
        </Card>
      ) : (
        <Card className={classes.card} styles={{ body: { padding: 0 } }}>
          <div className={classes.centeredColumn}>
            <span className={classes.centeredRow2}>
              {metadata.item ? <ThemedSvgIcon src={getDriveItemIcon(metadata.item)} className={classes.icon} /> : <FileOutlined />}
            </span>
            <Typography.Title level={3} ellipsis={{ tooltip: metadata.item.name }} className={classes.title}>
              {metadata.item.name}
            </Typography.Title>
            <Tag color="blue">{permissionLabels[metadata.permission]}</Tag>
          </div>

          <div className={classes.div}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Type">{metadata.item.type === "folder" ? "Folder" : metadata.item.mimeType ?? "File"}</Descriptions.Item>
              <Descriptions.Item label="Size">{metadata.item.type === "folder" ? "—" : formatFileSize(Number(metadata.item.sizeBytes ?? 0))}</Descriptions.Item>
              <Descriptions.Item label="Last modified">{formatModifiedDate(metadata.item.updatedAt)}</Descriptions.Item>
              <Descriptions.Item label="Access">{permissionLabels[metadata.permission]}</Descriptions.Item>
            </Descriptions>

            <Typography.Paragraph type="secondary" className={classes.paragraph}>
              This item was shared through File Central. Public preview is not available on shared links.
            </Typography.Paragraph>

            {canDownload ? (
              <Button type="primary" block icon={<DownloadOutlined />} loading={downloadShare.isPending} onClick={handleDownload}>
                Download file
              </Button>
            ) : (
              <Result
                className={classes.result}
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
