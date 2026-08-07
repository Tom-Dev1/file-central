import { ArrowLeftOutlined, FolderOutlined, HomeOutlined } from "@ant-design/icons";
import { App, Button, Empty, List, Modal, Result, Skeleton, Space, Typography } from "antd";
import { useMemo, useState } from "react";

import { useDriveList, useMoveItem } from "@/hooks";

interface MoveItemModalProps {
  open: boolean;
  itemId: string;
  itemName: string;
  currentParentId: string | null;
  expectedMetadataVersion: number;
  onClose: () => void;
}

interface FolderLocation {
  id: string | null;
  name: string;
}

export function MoveItemModal({
  open,
  itemId,
  itemName,
  currentParentId,
  expectedMetadataVersion,
  onClose,
}: MoveItemModalProps) {
  const [locations, setLocations] = useState<FolderLocation[]>([{ id: null, name: "My Drive" }]);
  const { message } = App.useApp();
  const moveItem = useMoveItem();
  const currentLocation = locations.at(-1) ?? locations[0];
  const listParams = useMemo(
    () => ({ parentId: currentLocation.id ?? undefined, limit: 100 }),
    [currentLocation.id]
  );
  const foldersQuery = useDriveList(listParams);
  const folders = (foldersQuery.data?.items ?? []).filter((candidate) => candidate.type === "folder");
  const destinationUnchanged = currentLocation.id === currentParentId;

  const handleClose = () => {
    setLocations([{ id: null, name: "My Drive" }]);
    onClose();
  };

  const handleMove = () => {
    moveItem.mutate(
      {
        id: itemId,
        body: { newParentId: currentLocation.id, expectedMetadataVersion },
      },
      {
        onSuccess: () => {
          void message.success(`${itemName} moved`);
          handleClose();
        },
        onError: (error) => {
          void message.error(error instanceof Error ? error.message : "Unable to move this item.");
        },
      }
    );
  };

  return (
    <Modal
      open={open}
      title={`Move “${itemName}”`}
      okText="Move here"
      okButtonProps={{ disabled: destinationUnchanged }}
      confirmLoading={moveItem.isPending}
      onOk={handleMove}
      onCancel={handleClose}
      destroyOnHidden
    >
      <Space className="!mb-3 !w-full" size="small">
        <Button
          type="text"
          aria-label="Go to parent folder"
          icon={<ArrowLeftOutlined />}
          disabled={locations.length === 1}
          onClick={() => setLocations((current) => current.slice(0, -1))}
        />
        <HomeOutlined className="text-primary" />
        <Typography.Text strong ellipsis={{ tooltip: currentLocation.name }}>
          {currentLocation.name}
        </Typography.Text>
      </Space>

      <div className="min-h-64 max-h-[45vh] overflow-y-auto rounded-xl border">
        {foldersQuery.isLoading ? (
          <div className="p-4"><Skeleton active paragraph={{ rows: 4 }} /></div>
        ) : foldersQuery.isError ? (
          <Result
            status="error"
            title="Unable to load folders"
            extra={<Button onClick={() => void foldersQuery.refetch()}>Try again</Button>}
          />
        ) : folders.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No folders here" className="!my-12" />
        ) : (
          <List
            dataSource={folders}
            renderItem={(folder) => {
              const isItemItself = folder.id === itemId;
              return (
                <List.Item
                  className="!px-4"
                  actions={[
                    <Button
                      key="open"
                      type="link"
                      disabled={isItemItself}
                      onClick={() => setLocations((current) => [...current, { id: folder.id, name: folder.name }])}
                    >
                      Open
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={<FolderOutlined className="text-xl text-primary" />}
                    title={<Typography.Text disabled={isItemItself} ellipsis={{ tooltip: folder.name }}>{folder.name}</Typography.Text>}
                    description={isItemItself ? "An item cannot be moved into itself" : `${folder.childCount ?? 0} items`}
                  />
                </List.Item>
              );
            }}
          />
        )}
      </div>
      {destinationUnchanged && (
        <Typography.Text type="secondary" className="!mt-3 block !text-xs">
          This item is already in {currentLocation.name}.
        </Typography.Text>
      )}
    </Modal>
  );
}
