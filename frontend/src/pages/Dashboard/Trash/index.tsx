import { DeleteOutlined, ReloadOutlined, RestOutlined } from "@ant-design/icons";
import { App, Button, Empty, Popconfirm, Result, Space, Typography } from "antd";

import { DrivePageShell } from "@/components/drive/DrivePageShell";
import { DriveSubHeader } from "@/components/drive/DriveSubHeader";
import { DriveListMetadataCell, DriveListView, type DriveListMetadataColumn } from "@/components/drive/list";
import { formatDriveFileSize, formatModifiedDate } from "@/constants/file-constants";
import { usePurgeAllTrash, usePurgeItem, useRestoreItem, useTrashList } from "@/hooks";
import type { DriveItem } from "@/types/api.types";
import { Trash2 } from "lucide-react";
import classes from "./index.module.css";


export default function TrashPage() {
  const { message } = App.useApp();
  const trashQuery = useTrashList();
  const restoreItem = useRestoreItem();
  const purgeItem = usePurgeItem();
  const purgeAll = usePurgeAllTrash();
  const items = trashQuery.data ?? [];

  const handleRestore = (item: DriveItem) => {
    restoreItem.mutate(item.id, {
      onSuccess: () => void message.success(`${item.name} restored`),
      onError: (error) => void message.error(error instanceof Error ? error.message : "Unable to restore this item."),
    });
  };

  const handlePurge = (item: DriveItem) => {
    purgeItem.mutate(item.id, {
      onSuccess: () => void message.success(`${item.name} permanently deleted`),
      onError: (error) => void message.error(error instanceof Error ? error.message : "Unable to delete this item."),
    });
  };

  const handlePurgeAll = () => {
    purgeAll.mutate(undefined, {
      onSuccess: () => void message.success("Trash emptied"),
      onError: (error) => void message.error(error instanceof Error ? error.message : "Unable to empty Trash."),
    });
  };

  const columns: DriveListMetadataColumn[] = [
    {
      key: "deleted",
      title: "Deleted",
      width: 170,
      responsive: ["md"],
      render: (item) => <DriveListMetadataCell>{formatModifiedDate(item.trashedAt ?? item.lastModifiedAt)}</DriveListMetadataCell>,
    },
    {
      key: "type",
      title: "Type",
      width: 110,
      responsive: ["lg"],
      render: (item) => <DriveListMetadataCell>{item.type === "folder" ? "Folder" : item.extension?.toUpperCase() || "File"}</DriveListMetadataCell>,
    },
    {
      key: "size",
      title: "File size",
      width: 120,
      responsive: ["xl"],
      render: (item) => <DriveListMetadataCell>{item.type === "folder" ? "—" : formatDriveFileSize(item)}</DriveListMetadataCell>,
    },
  ];

  return (
    <DrivePageShell
      header={
        <DriveSubHeader
          title="Trash"
          titleHref={null}
          description={`${items.length} ${items.length === 1 ? "item" : "items"}`}
          icon={Trash2}
          actions={
            <Popconfirm
              title="Empty Trash?"
              description="All items in Trash will be permanently deleted."
              okText="Empty Trash"
              okButtonProps={{ danger: true }}
              disabled={items.length === 0}
              onConfirm={handlePurgeAll}
            >
              <Button danger icon={<DeleteOutlined />} disabled={items.length === 0} loading={purgeAll.isPending}>
                Empty Trash
              </Button>
            </Popconfirm>
          }
        />
      }
    >
      {trashQuery.isError ? (
        <Result
          status="error"
          title="Unable to load Trash"
          subTitle="Your deleted items could not be loaded."
          extra={<Button icon={<ReloadOutlined />} onClick={() => void trashQuery.refetch()}>Try again</Button>}
        />
      ) : (
        <div className={classes.div3}>
          <DriveListView
            items={items}
            loading={trashQuery.isLoading}
            selectable={false}
            metadataColumns={columns}
            renderNameDetails={(item) => (
              <Typography.Text type="secondary" className={classes.text2}>
                Deleted {formatModifiedDate(item.trashedAt ?? item.lastModifiedAt)} · {item.type === "folder" ? "Folder" : formatDriveFileSize(item)}
              </Typography.Text>
            )}
            renderActions={(item) => (
              <Space size={2}>
                <Button
                  type="text"
                  shape="circle"
                  aria-label={`Restore ${item.name}`}
                  title="Restore"
                  icon={<RestOutlined />}
                  loading={restoreItem.isPending && restoreItem.variables === item.id}
                  onClick={() => handleRestore(item)}
                />
                <Popconfirm
                  title="Delete permanently?"
                  description="This item cannot be recovered."
                  okText="Delete forever"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => handlePurge(item)}
                >
                  <Button
                    type="text"
                    danger
                    shape="circle"
                    aria-label={`Permanently delete ${item.name}`}
                    title="Delete forever"
                    icon={<DeleteOutlined />}
                    loading={purgeItem.isPending && purgeItem.variables === item.id}
                  />
                </Popconfirm>
              </Space>
            )}
            ariaLabel="Items in Trash"
            loadingAriaLabel="Loading items in Trash"
            emptyState={
              <div className={classes.centeredRow}>
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Trash is empty" />
              </div>
            }
            actionsWidth={110}
            scrollX={724}
          />
        </div>
      )}
    </DrivePageShell>
  );
}
