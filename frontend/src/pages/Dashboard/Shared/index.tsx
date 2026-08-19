import { DeleteOutlined, DownloadOutlined, EyeOutlined, FolderOpenOutlined, ReloadOutlined } from "@ant-design/icons";
import { App, Button, Empty, Popconfirm, Result, Space, Tabs, Tag, Typography } from "antd";
import { Share2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { DrivePageShell } from "@/components/drive/DrivePageShell";
import { DriveSubHeader } from "@/components/drive/DriveSubHeader";
import {
  DriveListMetadataCell,
  DriveListView,
  type DriveListItemAdapter,
  type DriveListMetadataColumn,
} from "@/components/drive/list";
import { FilePreviewDialog } from "@/components/file-preview/FilePreviewDialog";
import { formatDriveFileSize, formatModifiedDate } from "@/constants/file-constants";
import { useDownloadFile, useMyShares, useRevokeShare, useSharedWithMe } from "@/hooks";
import type { DriveItem, Share, SharePermission, SharedWithMeRow } from "@/types/api.types";
import classes from "./index.module.css";


const permissionLabels: Record<SharePermission, string> = {
  view: "View only",
  download: "Can download",
  edit: "Can edit",
};

const sharedWithMeAdapter: DriveListItemAdapter<SharedWithMeRow> = {
  getId: (row) => row.item.id,
  getName: (row) => row.item.name,
  getType: (row) => row.item.type,
  getDriveItem: (row) => row.item,
};

const myShareAdapter: DriveListItemAdapter<Share> = {
  getId: (share) => share.id,
  getName: (share) => share.itemId,
  getType: (share) => share.itemType,
};

export default function SharedPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const sharedQuery = useSharedWithMe();
  const mySharesQuery = useMyShares();
  const revokeShare = useRevokeShare();
  const downloadFile = useDownloadFile();
  const [previewRow, setPreviewRow] = useState<SharedWithMeRow | null>(null);
  const [activeTab, setActiveTab] = useState<"shared" | "mine">("shared");
  const rows = sharedQuery.data ?? [];
  const myShares = mySharesQuery.data ?? [];

  const openItem = (row: SharedWithMeRow) => {
    if (row.item.type === "folder") {
      navigate(`/dashboard/shared/folders/${row.item.id}`, {
        state: { sharedPath: [{ id: row.item.id, name: row.item.name }] },
      });
    } else {
      setPreviewRow(row);
    }
  };

  const download = (item: DriveItem) => {
    downloadFile.mutate(
      { fileId: item.id, fallbackName: item.name },
      { onError: (error) => void message.error(error instanceof Error ? error.message : "Unable to download this file.") }
    );
  };

  const revoke = (share: Share) => {
    revokeShare.mutate(share.id, {
      onSuccess: () => void message.success("Share revoked"),
      onError: (error) => void message.error(error instanceof Error ? error.message : "Unable to revoke this share."),
    });
  };

  const sharedColumns: DriveListMetadataColumn<SharedWithMeRow>[] = [
    {
      key: "shared",
      title: "Shared",
      width: 170,
      responsive: ["md"],
      render: (row) => (
        <DriveListMetadataCell>{formatModifiedDate(row.share.createdAt)}</DriveListMetadataCell>
      ),
    },
    {
      key: "permission",
      title: "Permission",
      width: 150,
      responsive: ["lg"],
      render: (row) => <Tag color="blue">{permissionLabels[row.share.permission]}</Tag>,
    },
    {
      key: "size",
      title: "File size",
      width: 120,
      responsive: ["xl"],
      render: (row) => (
        <DriveListMetadataCell>
          {row.item.type === "folder" ? "—" : formatDriveFileSize(row.item)}
        </DriveListMetadataCell>
      ),
    },
  ];

  const myShareColumns: DriveListMetadataColumn<Share>[] = [
    {
      key: "recipient",
      title: "Shared with",
      width: 220,
      responsive: ["md"],
      render: (share) => (
        <Typography.Text ellipsis={{ tooltip: share.sharedWithEmail ?? share.sharedWithUserId ?? "Public link" }}>
          {share.shareType === "public_link" ? "Public link" : share.sharedWithEmail ?? share.sharedWithUserId ?? "User"}
        </Typography.Text>
      ),
    },
    {
      key: "permission",
      title: "Permission",
      width: 140,
      responsive: ["sm"],
      render: (share) => <Tag color="blue">{permissionLabels[share.permission]}</Tag>,
    },
    {
      key: "created",
      title: "Created",
      width: 160,
      responsive: ["lg"],
      render: (share) => (
        <Typography.Text type="secondary">{formatModifiedDate(share.createdAt)}</Typography.Text>
      ),
    },
  ];

  return (
    <DrivePageShell
      header={
        <DriveSubHeader
          title="Shared"
          titleHref={null}
          description={
            activeTab === "shared"
              ? `${rows.length} ${rows.length === 1 ? "item" : "items"} shared with you`
              : `${myShares.length} active ${myShares.length === 1 ? "share" : "shares"}`
          }
          icon={Share2}
        />
      }
    >
      <div className={classes.div2}>
        <Tabs
          className={classes.tabs}
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as "shared" | "mine")}
          items={[
            { key: "shared", label: `Shared with me (${rows.length})` },
            { key: "mine", label: `My shares (${myShares.length})` },
          ]}
        />

        <div className={classes.listRegion}>
          {activeTab === "shared" ? (
            sharedQuery.isError ? (
              <Result
                status="error"
                title="Unable to load shared items"
                extra={<Button icon={<ReloadOutlined />} onClick={() => void sharedQuery.refetch()}>Try again</Button>}
              />
            ) : (
              <DriveListView<SharedWithMeRow>
                items={rows}
                itemAdapter={sharedWithMeAdapter}
                loading={sharedQuery.isLoading}
                selectable={false}
                metadataColumns={sharedColumns}
                renderNameDetails={(row) => (
                  <div className={classes.row2}>
                    <Tag color="blue" className={classes.tag}>
                      {permissionLabels[row.share.permission]}
                    </Tag>
                    <Typography.Text type="secondary" className={classes.text2}>
                      {formatModifiedDate(row.share.createdAt)}
                    </Typography.Text>
                  </div>
                )}
                renderActions={(row) => (
                  <Space size={2}>
                    <Button
                      type="text"
                      shape="circle"
                      aria-label={`${row.item.type === "folder" ? "Open" : "Preview"} ${row.item.name}`}
                      icon={row.item.type === "folder" ? <FolderOpenOutlined /> : <EyeOutlined />}
                      onClick={() => openItem(row)}
                    />
                    {row.item.type === "file" && row.share.permission !== "view" && (
                      <Button
                        type="text"
                        shape="circle"
                        aria-label={`Download ${row.item.name}`}
                        icon={<DownloadOutlined />}
                        loading={downloadFile.isPending && downloadFile.variables?.fileId === row.item.id}
                        onClick={() => download(row.item)}
                      />
                    )}
                  </Space>
                )}
                onOpenItem={openItem}
                onPreviewItem={openItem}
                ariaLabel="Items shared with me"
                loadingAriaLabel="Loading items shared with me"
                emptyState={
                  <div className={classes.centeredRow}>
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nothing has been shared with you yet" />
                  </div>
                }
                actionsWidth={92}
                scrollX={720}
              />
            )
          ) : mySharesQuery.isError ? (
            <Result
              status="error"
              title="Unable to load your shares"
              extra={<Button icon={<ReloadOutlined />} onClick={() => void mySharesQuery.refetch()}>Try again</Button>}
            />
          ) : (
            <DriveListView<Share>
              items={myShares}
              itemAdapter={myShareAdapter}
              loading={mySharesQuery.isLoading}
              selectable={false}
              reserveSelectionSpace={false}
              nameColumnTitle="Item"
              metadataColumns={myShareColumns}
              renderName={(share) => (
                <div className={classes.div}>
                  <Typography.Text strong className={classes.text} copyable={{ text: share.itemId }}>
                    {share.itemType === "folder" ? "Folder" : "File"}
                  </Typography.Text>
                  <Typography.Text
                    type="secondary"
                    ellipsis={{ tooltip: share.itemId }}
                    className={classes.text3}
                  >
                    {share.itemId}
                  </Typography.Text>
                </div>
              )}
              renderActions={(share) => (
                <Popconfirm
                  title="Revoke this share?"
                  description="The recipient or public link will lose access."
                  okText="Revoke"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => revoke(share)}
                >
                  <Button
                    type="text"
                    danger
                    shape="circle"
                    aria-label={`Revoke share ${share.id}`}
                    icon={<DeleteOutlined />}
                    disabled={share.isRevoked}
                    loading={revokeShare.isPending && revokeShare.variables === share.id}
                  />
                </Popconfirm>
              )}
              actionsAlwaysVisible
              actionsWidth={64}
              ariaLabel="Items I have shared"
              loadingAriaLabel="Loading items I have shared"
              emptyState={
                <div className={classes.centeredRow}>
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="You have not shared any items yet"
                  />
                </div>
              }
              scrollX={784}
            />
          )}
        </div>
      </div>

      {previewRow && (
        <FilePreviewDialog
          item={previewRow.item}
          open
          allowDownload={previewRow.share.permission !== "view"}
          onOpenChange={(open) => !open && setPreviewRow(null)}
        />
      )}
    </DrivePageShell>
  );
}
