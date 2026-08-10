import { DeleteOutlined, DownloadOutlined, EyeOutlined, FolderOpenOutlined, ReloadOutlined } from "@ant-design/icons";
import { App, Button, Empty, Popconfirm, Result, Skeleton, Space, Table, Tabs, Tag, Typography, type TableColumnsType } from "antd";
import { Share2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { DrivePageShell } from "@/components/drive/DrivePageShell";
import { DriveSubHeader } from "@/components/drive/DriveSubHeader";
import { FilePreviewDialog } from "@/components/file-preview/FilePreviewDialog";
import { ThemedSvgIcon } from "@/components/theme/ThemedSvgIcon";
import { formatFileSize, formatModifiedDate } from "@/constants/file-constants";
import { useDownloadFile, useMyShares, useRevokeShare, useSharedWithMe } from "@/hooks";
import type { DriveItem, Share, SharePermission, SharedWithMeRow } from "@/types/api.types";
import { getDriveItemIcon } from "@/utils/file-utils";
import classes from "./index.module.css";


const permissionLabels: Record<SharePermission, string> = {
  view: "View only",
  download: "Can download",
  edit: "Can edit",
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

  const columns: TableColumnsType<SharedWithMeRow> = [
    {
      key: "name",
      title: "Name",
      render: (_, row) => (
        <div className={classes.row}>
          <ThemedSvgIcon src={getDriveItemIcon(row.item)} className={classes.icon} />
          <div className={classes.div}>
            <Typography.Text strong ellipsis={{ tooltip: row.item.name }} className={classes.text}>{row.item.name}</Typography.Text>
            <div className={classes.row2}>
              <Tag color="blue" className={classes.tag}>{permissionLabels[row.share.permission]}</Tag>
              <Typography.Text type="secondary" className={classes.text2}>{formatModifiedDate(row.share.createdAt)}</Typography.Text>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "permission",
      title: "Permission",
      width: 150,
      responsive: ["md"],
      render: (_, row) => <Tag color="blue">{permissionLabels[row.share.permission]}</Tag>,
    },
    {
      key: "shared",
      title: "Shared",
      width: 160,
      responsive: ["lg"],
      render: (_, row) => <Typography.Text type="secondary">{formatModifiedDate(row.share.createdAt)}</Typography.Text>,
    },
    {
      key: "size",
      title: "Size",
      width: 110,
      responsive: ["xl"],
      render: (_, row) => <Typography.Text type="secondary">{row.item.type === "folder" ? "—" : formatFileSize(Number(row.item.sizeBytes ?? 0))}</Typography.Text>,
    },
    {
      key: "actions",
      title: <span className={classes.visuallyHidden}>Actions</span>,
      width: 92,
      align: "right",
      render: (_, row) => (
        <Space size={2} onClick={(event) => event.stopPropagation()}>
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
      ),
    },
  ];

  const myShareColumns: TableColumnsType<Share> = [
    {
      key: "item",
      title: "Item",
      render: (_, share) => (
        <div className={classes.div}>
          <Typography.Text strong className={classes.text} copyable={{ text: share.itemId }}>
            {share.itemType === "folder" ? "Folder" : "File"}
          </Typography.Text>
          <Typography.Text type="secondary" ellipsis={{ tooltip: share.itemId }} className={classes.text3}>
            {share.itemId}
          </Typography.Text>
        </div>
      ),
    },
    {
      key: "recipient",
      title: "Shared with",
      width: 220,
      responsive: ["md"],
      render: (_, share) => (
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
      render: (_, share) => <Tag color="blue">{permissionLabels[share.permission]}</Tag>,
    },
    {
      key: "created",
      title: "Created",
      width: 160,
      responsive: ["lg"],
      render: (_, share) => <Typography.Text type="secondary">{formatModifiedDate(share.createdAt)}</Typography.Text>,
    },
    {
      key: "actions",
      title: <span className={classes.visuallyHidden}>Actions</span>,
      width: 64,
      align: "right",
      render: (_, share) => (
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
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as "shared" | "mine")}
          items={[
            { key: "shared", label: `Shared with me (${rows.length})` },
            { key: "mine", label: `My shares (${myShares.length})` },
          ]}
        />

        {activeTab === "shared" ? (
          sharedQuery.isLoading ? (
            <Skeleton active paragraph={{ rows: 7 }} />
          ) : sharedQuery.isError ? (
            <Result
              status="error"
              title="Unable to load shared items"
              extra={<Button icon={<ReloadOutlined />} onClick={() => void sharedQuery.refetch()}>Try again</Button>}
            />
          ) : rows.length === 0 ? (
            <div className={classes.centeredRow}>
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nothing has been shared with you yet" />
            </div>
          ) : (
            <Table
              rowKey={(row) => row.share.id}
              columns={columns}
              dataSource={rows}
              pagination={false}
              tableLayout="fixed"
              className={classes.table}
              rowClassName={classes.clickableRow}
              onRow={(row) => ({
                tabIndex: 0,
                onClick: () => openItem(row),
                onKeyDown: (event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openItem(row);
                  }
                },
              })}
            />
          )
        ) : mySharesQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 7 }} />
        ) : mySharesQuery.isError ? (
          <Result
            status="error"
            title="Unable to load your shares"
            extra={<Button icon={<ReloadOutlined />} onClick={() => void mySharesQuery.refetch()}>Try again</Button>}
          />
        ) : myShares.length === 0 ? (
          <div className={classes.centeredRow}>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="You have not shared any items yet" />
          </div>
        ) : (
          <Table
            rowKey="id"
            columns={myShareColumns}
            dataSource={myShares}
            pagination={false}
            tableLayout="fixed"
            className={classes.table}
          />
        )}
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
