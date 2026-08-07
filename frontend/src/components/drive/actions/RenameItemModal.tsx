import { App, Form, Input, Modal } from "antd";
import { useEffect } from "react";

import { useRenameItem } from "@/hooks";

interface RenameItemModalProps {
  open: boolean;
  itemId: string;
  currentName: string;
  expectedMetadataVersion: number;
  onClose: () => void;
}

interface RenameFormValues {
  name: string;
}

export function RenameItemModal({
  open,
  itemId,
  currentName,
  expectedMetadataVersion,
  onClose,
}: RenameItemModalProps) {
  const [form] = Form.useForm<RenameFormValues>();
  const { message } = App.useApp();
  const renameItem = useRenameItem();

  useEffect(() => {
    if (open) {
      form.setFieldsValue({ name: currentName });
    }
  }, [currentName, form, open]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    renameItem.mutate(
      {
        id: itemId,
        body: { name: values.name.trim(), expectedMetadataVersion },
      },
      {
        onSuccess: () => {
          void message.success("Item renamed");
          onClose();
        },
        onError: (error) => {
          void message.error(error instanceof Error ? error.message : "Unable to rename this item.");
        },
      }
    );
  };

  return (
    <Modal
      open={open}
      title="Rename item"
      okText="Rename"
      confirmLoading={renameItem.isPending}
      onOk={() => void handleSubmit()}
      onCancel={onClose}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark={false} onFinish={() => void handleSubmit()}>
        <Form.Item
          name="name"
          label="Name"
          rules={[
            { required: true, whitespace: true, message: "Enter a name." },
            { max: 255, message: "Name must be 255 characters or fewer." },
          ]}
        >
          <Input autoFocus maxLength={255} onFocus={(event) => event.currentTarget.select()} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
