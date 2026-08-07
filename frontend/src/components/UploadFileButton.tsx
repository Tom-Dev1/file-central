import { useRef, type ChangeEvent } from "react";
import { UploadOutlined } from "@ant-design/icons";
import { App, Button } from "antd";

import { UploadNotificationContent } from "@/components/upload/UploadNotificationContent";
import { formatFileSize } from "@/constants/file-constants";
import { useUploadFile } from "@/hooks";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/upload-utils";

interface UploadFileButtonProps {
  parentId?: string | null;
  className?: string;
  variant?: "menu" | "button";
}

export function UploadFileButton({ parentId, className, variant = "menu" }: UploadFileButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const lastProgressRef = useRef(-1);
  const uploadFile = useUploadFile();
  const { notification } = App.useApp();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    lastProgressRef.current = -1;
    const notificationKey = `file-upload-${file.name}-${file.lastModified}`;

    notification.open({
      key: notificationKey,
      message: `Uploading ${file.name}`,
      description: <UploadNotificationContent percent={0} detail={`0 B of ${formatFileSize(file.size)}`} />,
      duration: 0,
      placement: "bottomRight",
    });

    uploadFile.mutate(
      {
        file,
        parentId,
        onProgress: (progress) => {
          if (progress === lastProgressRef.current) return;
          lastProgressRef.current = progress;
          const uploadedBytes = file.size * (progress / 100);

          notification.open({
            key: notificationKey,
            message: `Uploading ${file.name}`,
            description: (
              <UploadNotificationContent
                percent={progress}
                detail={`${formatFileSize(uploadedBytes)} of ${formatFileSize(file.size)}`}
              />
            ),
            duration: 0,
            placement: "bottomRight",
          });
        },
      },
      {
        onSuccess: () => {
          notification.success({
            key: notificationKey,
            message: "Upload complete",
            description: file.name,
            duration: 3,
            placement: "bottomRight",
          });
          input.value = "";
        },
        onError: (error) => {
          notification.error({
            key: notificationKey,
            message: "Upload failed",
            description: getErrorMessage(error),
            duration: 5,
            placement: "bottomRight",
          });
          input.value = "";
        },
      }
    );
  };

  return (
    <>
      <input ref={inputRef} type="file" className="hidden" onChange={handleFileChange} />
      <Button
        type={variant === "menu" ? "text" : "default"}
        block={variant === "menu"}
        loading={uploadFile.isPending}
        disabled={uploadFile.isPending}
        onClick={() => inputRef.current?.click()}
        className={cn(variant === "menu" && "justify-start", className)}
        icon={<UploadOutlined />}
      >
        {uploadFile.isPending ? "Uploading..." : "File upload"}
      </Button>
    </>
  );
}
