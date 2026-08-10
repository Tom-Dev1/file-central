import { CopyOutlined, LinkOutlined, MailOutlined } from "@ant-design/icons";
import { App, Button, DatePicker, Form, Input, Modal, Segmented, Select, Space, Typography } from "antd";
import { useState } from "react";

import { useCreateShare } from "@/hooks";
import type { SharePermission, ShareType } from "@/types/api.types";
import classes from "./ShareItemModal.module.css";


interface ShareItemModalProps {
  open: boolean;
  itemId: string;
  itemName: string;
  onClose: () => void;
}

interface ShareFormValues {
  shareType: ShareType;
  permission: SharePermission;
  sharedWithEmail?: string;
  expiresAt?: { toISOString: () => string };
}

export function ShareItemModal({ open, itemId, itemName, onClose }: ShareItemModalProps) {
  const [form] = Form.useForm<ShareFormValues>();
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const { message } = App.useApp();
  const createShare = useCreateShare();
  const shareType = Form.useWatch("shareType", form) ?? "user";

  const handleClose = () => {
    form.resetFields();
    setPublicUrl(null);
    onClose();
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    createShare.mutate(
      {
        itemId,
        shareType: values.shareType,
        permission: values.permission,
        sharedWithEmail: values.shareType === "user" ? values.sharedWithEmail?.trim() : undefined,
        expiresAt: values.expiresAt?.toISOString() ?? null,
      },
      {
        onSuccess: ({ token }) => {
          if (token) {
            setPublicUrl(`${window.location.origin}/shares/public/${encodeURIComponent(token)}`);
            void message.success("Public link created");
          } else {
            void message.success("Item shared");
            handleClose();
          }
        },
        onError: (error) => {
          void message.error(error instanceof Error ? error.message : "Unable to share this item.");
        },
      }
    );
  };

  const copyPublicUrl = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      void message.success("Link copied");
    } catch {
      void message.error("Unable to copy the link. Select it and copy manually.");
    }
  };

  return (
    <Modal
      open={open}
      title={`Share “${itemName}”`}
      okText={publicUrl ? "Done" : "Share"}
      cancelButtonProps={{ style: publicUrl ? { display: "none" } : undefined }}
      confirmLoading={createShare.isPending}
      onOk={publicUrl ? handleClose : () => void handleSubmit()}
      onCancel={handleClose}
      destroyOnHidden
    >
      {publicUrl ? (
        <div className={classes.div}>
          <Typography.Paragraph type="secondary">
            Anyone with this link can access the item with the permission you selected.
          </Typography.Paragraph>
          <Space.Compact block>
            <Input value={publicUrl} readOnly aria-label="Public share link" />
            <Button icon={<CopyOutlined />} aria-label="Copy public share link" onClick={() => void copyPublicUrl()}>
              Copy
            </Button>
          </Space.Compact>
        </div>
      ) : (
        <Form form={form} layout="vertical" requiredMark={false} initialValues={{ shareType: "user", permission: "view" }}>
          <Form.Item name="shareType" label="Share method">
            <Segmented
              block
              options={[
                { label: "Specific person", value: "user", icon: <MailOutlined /> },
                { label: "Public link", value: "public_link", icon: <LinkOutlined /> },
              ]}
            />
          </Form.Item>

          {shareType === "user" && (
            <Form.Item
              name="sharedWithEmail"
              label="Email address"
              rules={[
                { required: true, message: "Enter the recipient's email address." },
                { type: "email", message: "Enter a valid email address." },
              ]}
            >
              <Input autoFocus prefix={<MailOutlined />} placeholder="name@example.com" />
            </Form.Item>
          )}

          <Form.Item name="permission" label="Permission" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "view", label: "View only" },
                { value: "download", label: "View and download" },
                { value: "edit", label: "Edit" },
              ]}
            />
          </Form.Item>

          <Form.Item name="expiresAt" label="Expiry (optional)">
            <DatePicker showTime className={classes.datepicker} placeholder="No expiry" />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}
