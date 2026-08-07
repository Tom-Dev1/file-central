import { ArrowLeftOutlined, EyeOutlined, FolderOpenOutlined, ReloadOutlined } from "@ant-design/icons";
import { Breadcrumb, Button, Empty, Result, Skeleton, Space, Table, Typography, type TableColumnsType } from "antd";
import { Folder } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { DrivePageShell } from "@/components/drive/DrivePageShell";
import { DriveSubHeader } from "@/components/drive/DriveSubHeader";
import { FilePreviewDialog } from "@/components/file-preview/FilePreviewDialog";
import { ThemedSvgIcon } from "@/components/theme/ThemedSvgIcon";
import { formatFileSize, formatModifiedDate } from "@/constants/file-constants";
import { useSharedFolderChildren } from "@/hooks";
import type { DriveItem } from "@/types/api.types";
import { getDriveItemIcon } from "@/utils/file-utils";

interface SharedPathItem {
  id: string;
  name: string;
}

interface SharedFolderLocationState {
  sharedPath?: SharedPathItem[];
}

export default function SharedFolderPage() {
  const { folderId = "" } = useParams<{ folderId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const childrenQuery = useSharedFolderChildren(folderId);
  const [previewItem, setPreviewItem] = useState<DriveItem | null>(null);
  const items = childrenQuery.data ?? [];
  const routePath = (location.state as SharedFolderLocationState | null)?.sharedPath ?? [];
  const routeFolder = routePath.find((part) => part.id === folderId);
  const currentFolder: SharedPathItem = routeFolder ?? {
    id: folderId,
    name: folderId ? `Shared folder ${folderId.slice(0, 8)}` : "Shared folder",
  };
  const currentPath = routePath.some((part) => part.id === folderId)
    ? routePath.slice(0, routePath.findIndex((part) => part.id === folderId) + 1)
    : [currentFolder];

  const openItem = (item: DriveItem) => {
    if (item.type === "folder") {
      navigate(`/dashboard/shared/folders/${item.id}`, {
        state: { sharedPath: [...currentPath, { id: item.id, name: item.name }] },
      });
    }
    else setPreviewItem(item);
  };

  const navigateToParent = () => {
    const parent = currentPath.at(-2);
    if (!parent) {
      navigate("/dashboard/shared");
      return;
    }
    navigate(`/dashboard/shared/folders/${parent.id}`, {
      state: { sharedPath: currentPath.slice(0, -1) },
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
            <Typography.Text type="secondary" className="block text-xs md:hidden">{formatModifiedDate(item.updatedAt)} · {item.type === "folder" ? "Folder" : formatFileSize(Number(item.sizeBytes ?? 0))}</Typography.Text>
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
    { key: "modified", title: "Modified", width: 170, responsive: ["md"], render: (_, item) => <Typography.Text type="secondary">{formatModifiedDate(item.updatedAt)}</Typography.Text> },
    { key: "size", title: "Size", width: 120, responsive: ["xl"], render: (_, item) => <Typography.Text type="secondary">{item.type === "folder" ? "—" : formatFileSize(Number(item.sizeBytes ?? 0))}</Typography.Text> },
    {
      key: "actions",
      title: <span className="sr-only">Actions</span>,
      width: 56,
      align: "right",
      render: (_, item) => (
        <Space onClick={(event) => event.stopPropagation()}>
          <Button
            type="text"
            shape="circle"
            aria-label={`${item.type === "folder" ? "Open" : "Preview"} ${item.name}`}
            icon={item.type === "folder" ? <FolderOpenOutlined /> : <EyeOutlined />}
            onClick={() => openItem(item)}
          />
        </Space>
      ),
    },
  ];

  return (
    <DrivePageShell
      header={
        <DriveSubHeader
          title={currentFolder.name}
          titleHref={null}
          description={`${items.length} ${items.length === 1 ? "item" : "items"}`}
          icon={Folder}
          leading={
            <Breadcrumb
              items={[
                { title: <Link to="/dashboard/shared">Shared with me</Link> },
                ...currentPath.map((part, index) => ({
                  title: index === currentPath.length - 1
                    ? <Typography.Text>{part.name}</Typography.Text>
                    : (
                      <Link
                        to={`/dashboard/shared/folders/${part.id}`}
                        state={{ sharedPath: currentPath.slice(0, index + 1) }}
                      >
                        {part.name}
                      </Link>
                    ),
                })),
              ]}
            />
          }
          actions={<Button icon={<ArrowLeftOutlined />} onClick={navigateToParent}>Parent folder</Button>}
        />
      }
    >
      {childrenQuery.isLoading ? (
        <div className="p-6"><Skeleton active paragraph={{ rows: 7 }} /></div>
      ) : childrenQuery.isError ? (
        <Result status="error" title="Unable to open shared folder" extra={<Button icon={<ReloadOutlined />} onClick={() => void childrenQuery.refetch()}>Try again</Button>} />
      ) : items.length === 0 ? (
        <div className="flex min-h-80 items-center justify-center p-6"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="This folder is empty" /></div>
      ) : (
        <div className="p-4 sm:p-6">
          <Table
            rowKey="id"
            columns={columns}
            dataSource={items}
            pagination={false}
            tableLayout="fixed"
            className="overflow-hidden rounded-xl"
            rowClassName="cursor-pointer"
            onRow={(item) => ({
              tabIndex: 0,
              onClick: () => openItem(item),
              onKeyDown: (event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openItem(item);
                }
              },
            })}
          />
        </div>
      )}
      {previewItem && (
        <FilePreviewDialog
          item={previewItem}
          open
          allowDownload={false}
          onOpenChange={(open) => !open && setPreviewItem(null)}
        />
      )}
    </DrivePageShell>
  );
}
