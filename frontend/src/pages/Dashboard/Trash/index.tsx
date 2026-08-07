import { DeleteOutlined, ReloadOutlined, RestOutlined } from "@ant-design/icons";
import { App, Button, Empty, Popconfirm, Result, Skeleton, Space, Table, Typography, type TableColumnsType } from "antd";

import { DrivePageShell } from "@/components/drive/DrivePageShell";
import { DriveSubHeader } from "@/components/drive/DriveSubHeader";
import { ThemedSvgIcon } from "@/components/theme/ThemedSvgIcon";
import { formatFileSize, formatModifiedDate } from "@/constants/file-constants";
import { usePurgeAllTrash, usePurgeItem, useRestoreItem, useTrashList } from "@/hooks";
import type { DriveItem } from "@/types/api.types";
import { getDriveItemIcon } from "@/utils/file-utils";
import { Trash2 } from "lucide-react";

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

  const columns: TableColumnsType<DriveItem> = [
    {
      key: "name",
      title: "Name",
      render: (_, item) => (
        <div className="flex min-w-0 items-center gap-3">
          <ThemedSvgIcon src={getDriveItemIcon(item)} className="size-5 shrink-0" />
          <div className="min-w-0">
            <Typography.Text strong ellipsis={{ tooltip: item.name }} className="block">{item.name}</Typography.Text>
            <Typography.Text type="secondary" className="block text-xs md:hidden">
              Deleted {formatModifiedDate(item.trashedAt ?? item.updatedAt)} · {item.type === "folder" ? "Folder" : formatFileSize(Number(item.sizeBytes ?? 0))}
            </Typography.Text>
          </div>
        </div>
      ),
    },
    {
      key: "type",
      title: "Type",
      width: 120,
      responsive: ["lg"],
      render: (_, item) => <Typography.Text type="secondary">{item.type === "folder" ? "Folder" : item.extension?.toUpperCase() || "File"}</Typography.Text>,
    },
    {
      key: "deleted",
      title: "Deleted",
      width: 170,
      responsive: ["md"],
      render: (_, item) => <Typography.Text type="secondary">{formatModifiedDate(item.trashedAt ?? item.updatedAt)}</Typography.Text>,
    },
    {
      key: "size",
      title: "Size",
      width: 120,
      responsive: ["xl"],
      render: (_, item) => <Typography.Text type="secondary">{item.type === "folder" ? "—" : formatFileSize(Number(item.sizeBytes ?? 0))}</Typography.Text>,
    },
    {
      key: "actions",
      title: <span className="sr-only">Actions</span>,
      width: 110,
      align: "right",
      render: (_, item) => (
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
      ),
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
      {trashQuery.isLoading ? (
        <div className="p-6"><Skeleton active paragraph={{ rows: 7 }} /></div>
      ) : trashQuery.isError ? (
        <Result
          status="error"
          title="Unable to load Trash"
          subTitle="Your deleted items could not be loaded."
          extra={<Button icon={<ReloadOutlined />} onClick={() => void trashQuery.refetch()}>Try again</Button>}
        />
      ) : items.length === 0 ? (
        <div className="flex min-h-80 items-center justify-center p-6">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Trash is empty" />
        </div>
      ) : (
        <div className="p-4 sm:p-6">
          <Table rowKey="id" columns={columns} dataSource={items} pagination={false} tableLayout="fixed" className="overflow-hidden rounded-xl" />
        </div>
      )}
    </DrivePageShell>
  );
}
