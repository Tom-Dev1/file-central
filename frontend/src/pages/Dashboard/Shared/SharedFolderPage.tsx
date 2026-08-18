import { ArrowLeftOutlined, EyeOutlined, FolderOpenOutlined, ReloadOutlined } from "@ant-design/icons";
import { Breadcrumb, Button, Empty, Result, Typography } from "antd";
import { Folder } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { DrivePageShell } from "@/components/drive/DrivePageShell";
import { DriveSubHeader } from "@/components/drive/DriveSubHeader";
import { DriveListMetadataCell, DriveListView, type DriveListMetadataColumn } from "@/components/drive/list";
import { FilePreviewDialog } from "@/components/file-preview/FilePreviewDialog";
import { formatDriveFileSize, formatModifiedDate } from "@/constants/file-constants";
import { useSharedFolderChildren } from "@/hooks";
import type { DriveItem } from "@/types/api.types";
import classes from "./SharedFolderPage.module.css";


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

  const columns: DriveListMetadataColumn[] = [
    {
      key: "modified",
      title: "Last modified",
      width: 170,
      responsive: ["md"],
      render: (item) => <DriveListMetadataCell>{formatModifiedDate(item.lastModifiedAt)}</DriveListMetadataCell>,
    },
    {
      key: "type",
      title: "Type",
      width: 110,
      responsive: ["lg"],
      render: (item) => <DriveListMetadataCell>{item.type === "folder" ? "Folder" : item.extension?.toUpperCase() || "File"}</DriveListMetadataCell>,
    },
    { key: "size", title: "File size", width: 120, responsive: ["xl"], render: (item) => <DriveListMetadataCell>{item.type === "folder" ? "—" : formatDriveFileSize(item)}</DriveListMetadataCell> },
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
      {childrenQuery.isError ? (
        <Result status="error" title="Unable to open shared folder" extra={<Button icon={<ReloadOutlined />} onClick={() => void childrenQuery.refetch()}>Try again</Button>} />
      ) : (
        <div className={classes.div3}>
          <DriveListView
            items={items}
            loading={childrenQuery.isLoading}
            selectable={false}
            metadataColumns={columns}
            renderNameDetails={(item) => (
              <Typography.Text type="secondary" className={classes.text2}>
                {formatModifiedDate(item.lastModifiedAt)} · {item.type === "folder" ? "Folder" : formatDriveFileSize(item)}
              </Typography.Text>
            )}
            renderActions={(item) => (
              <Button
                type="text"
                shape="circle"
                aria-label={`${item.type === "folder" ? "Open" : "Preview"} ${item.name}`}
                icon={item.type === "folder" ? <FolderOpenOutlined /> : <EyeOutlined />}
                onClick={() => openItem(item)}
              />
            )}
            onOpenItem={openItem}
            onPreviewItem={openItem}
            ariaLabel={`Files in ${currentFolder.name}`}
            loadingAriaLabel={`Loading files in ${currentFolder.name}`}
            emptyState={
              <div className={classes.centeredRow}>
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="This folder is empty" />
              </div>
            }
            scrollX={686}
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
