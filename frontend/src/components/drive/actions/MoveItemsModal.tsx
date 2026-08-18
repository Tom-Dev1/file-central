import { ArrowLeftOutlined, FolderOutlined, HomeOutlined } from "@ant-design/icons";
import { App, Button, Empty, Flex, Modal, Result, Skeleton, Space, Table, Typography } from "antd";
import { useMemo, useState } from "react";

import { useDriveList, useMoveItems } from "@/hooks";
import type { DriveItem } from "@/types/api.types";

import classes from "./MoveItemModal.module.css";

interface MoveItemsModalProps {
  open: boolean;
  items: DriveItem[];
  onClose: () => void;
  onMoved: () => void;
}

interface FolderLocation {
  id: string | null;
  name: string;
}

const ROOT_LOCATION: FolderLocation = { id: null, name: "My Drive" };

export function MoveItemsModal({ open, items, onClose, onMoved }: MoveItemsModalProps) {
  const [locations, setLocations] = useState<FolderLocation[]>([ROOT_LOCATION]);
  const { message } = App.useApp();
  const moveItems = useMoveItems();
  const currentLocation = locations.at(-1) ?? ROOT_LOCATION;
  const selectedFolderIds = useMemo(
    () => new Set(items.filter((item) => item.type === "folder").map((item) => item.id)),
    [items],
  );
  const listParams = useMemo(
    () => ({ parentId: currentLocation.id ?? undefined, limit: 100 }),
    [currentLocation.id],
  );
  const foldersQuery = useDriveList(listParams);
  const folders = (foldersQuery.data?.items ?? []).filter((candidate) => candidate.type === "folder");
  const destinationUnchanged =
    items.length > 0 && items.every((item) => item.parentId === currentLocation.id);

  const handleClose = () => {
    setLocations([ROOT_LOCATION]);
    onClose();
  };

  const handleMove = () => {
    moveItems.mutate(
      {
        items: items.map((item) => ({
          id: item.id,
          expectedMetadataVersion: item.metadataVersion,
        })),
        newParentId: currentLocation.id,
      },
      {
        onSuccess: ({ movedIds }) => {
          const movedCount = movedIds.length;
          void message.success(
            movedCount === 0
              ? "Selected items are already in this folder"
              : `${movedCount} ${movedCount === 1 ? "item" : "items"} moved`,
          );
          onMoved();
          handleClose();
        },
        onError: (error) => {
          void message.error(
            error instanceof Error ? error.message : "Unable to move selected items.",
          );
        },
      },
    );
  };

  return (
    <Modal
      open={open}
      title={`Move ${items.length} ${items.length === 1 ? "item" : "items"}`}
      okText="Move here"
      okButtonProps={{ disabled: items.length === 0 || destinationUnchanged }}
      confirmLoading={moveItems.isPending}
      onOk={handleMove}
      onCancel={handleClose}
      destroyOnHidden
    >
      <Typography.Text type="secondary" className={classes.description}>
        Choose a destination folder for the selected items.
      </Typography.Text>

      <Space className={classes.space} size="small">
        <Button
          type="text"
          aria-label="Go to parent folder"
          icon={<ArrowLeftOutlined />}
          disabled={locations.length === 1}
          onClick={() => setLocations((current) => current.slice(0, -1))}
        />
        <HomeOutlined className={classes.icon} />
        <Typography.Text strong ellipsis={{ tooltip: currentLocation.name }}>
          {currentLocation.name}
        </Typography.Text>
      </Space>

      <div className={classes.div}>
        {foldersQuery.isLoading ? (
          <div className={classes.div2}>
            <Skeleton active paragraph={{ rows: 4 }} />
          </div>
        ) : foldersQuery.isError ? (
          <Result
            status="error"
            title="Unable to load folders"
            extra={<Button onClick={() => void foldersQuery.refetch()}>Try again</Button>}
          />
        ) : folders.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No folders here"
            className={classes.empty}
          />
        ) : (
          <Table<DriveItem>
            dataSource={folders}
            rowKey="id"
            showHeader={false}
            pagination={false}
            size="small"
            className={classes.folderTable}
            columns={[
              {
                key: "folder",
                render: (_, folder) => {
                  const isSelectedFolder = selectedFolderIds.has(folder.id);
                  return (
                    <Flex align="center" justify="space-between" gap={12}>
                      <Flex align="center" gap={12} className={classes.folderInfo}>
                        <FolderOutlined className={classes.icon2} />
                        <div className={classes.folderDetails}>
                          <Typography.Text
                            disabled={isSelectedFolder}
                            ellipsis={{ tooltip: folder.name }}
                          >
                            {folder.name}
                          </Typography.Text>
                          <Typography.Text type="secondary">
                            {isSelectedFolder
                              ? "A selected folder cannot be used as a destination"
                              : `${folder.childCount ?? 0} items`}
                          </Typography.Text>
                        </div>
                      </Flex>

                      <Button
                        type="link"
                        disabled={isSelectedFolder}
                        onClick={() =>
                          setLocations((current) => [
                            ...current,
                            { id: folder.id, name: folder.name },
                          ])
                        }
                      >
                        Open
                      </Button>
                    </Flex>
                  );
                },
              },
            ]}
          />
        )}
      </div>

      {destinationUnchanged && (
        <Typography.Text type="secondary" className={classes.text}>
          All selected items are already in {currentLocation.name}.
        </Typography.Text>
      )}
    </Modal>
  );
}
