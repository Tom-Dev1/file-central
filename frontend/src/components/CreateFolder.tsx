import { FolderAddOutlined } from "@ant-design/icons";
import { App, Button, Form, Input, Modal } from "antd";
import { useState } from "react";

import { useCreateFolder } from "@/hooks";
import { cn } from "@/lib/utils";

interface CreateFolderButtonProps {
  parentId?: string | null;
  className?: string;
  variant?: "menu" | "button";
}

interface CreateFolderFormValues {
  folderName: string;
}

export function CreateFolderButton({
  parentId,
  className,
  variant = "menu",
}: CreateFolderButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form] = Form.useForm<CreateFolderFormValues>();
  const folderName = Form.useWatch("folderName", form) ?? "";
  const createFolder = useCreateFolder();
  const { message } = App.useApp();

  const handleSubmit = ({ folderName: value }: CreateFolderFormValues) => {
    const normalizedName = value.trim();

    createFolder.mutate(
      {
        name: normalizedName,
        parentId: parentId ?? null,
      },
      {
        onSuccess: () => {
          void message.success("Folder created successfully.");
          form.resetFields();
          setDialogOpen(false);
        },
        onError: (error) => {
          void message.error(
            error instanceof Error ? error.message : "Unable to create folder. Please try again."
          );
        },
      }
    );
  };

  const handleCancel = () => {
    if (createFolder.isPending) {
      return;
    }

    form.resetFields();
    setDialogOpen(false);
  };

  return (
    <>
      <Button
        type={variant === "menu" ? "text" : "default"}
        block={variant === "menu"}
        className={cn(variant === "menu" && "justify-start", className)}
        icon={<FolderAddOutlined />}
        onClick={() => setDialogOpen(true)}
      >
        New folder
      </Button>

      <Modal
        open={dialogOpen}
        title="Create new folder"
        okText="Create folder"
        cancelText="Cancel"
        confirmLoading={createFolder.isPending}
        okButtonProps={{ disabled: !folderName.trim() }}
        cancelButtonProps={{ disabled: createFolder.isPending }}
        maskClosable={!createFolder.isPending}
        keyboard={!createFolder.isPending}
        destroyOnHidden
        onOk={() => form.submit()}
        onCancel={handleCancel}
      >
        <p className="mb-4 text-sm text-muted-foreground">Enter a name for the new folder.</p>
        <Form<CreateFolderFormValues>
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={handleSubmit}
        >
          <Form.Item
            name="folderName"
            label="Folder name"
            rules={[
              { required: true, whitespace: true, message: "Folder name is required." },
              { max: 255, message: "Folder names can contain up to 255 characters." },
            ]}
            extra={`${folderName.length}/255 characters`}
          >
            <Input
              autoFocus
              autoComplete="off"
              maxLength={255}
              placeholder="Untitled folder"
              disabled={createFolder.isPending}
              onPressEnter={() => form.submit()}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
