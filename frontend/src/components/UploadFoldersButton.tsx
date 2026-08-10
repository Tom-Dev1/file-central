import { useRef, useState, type ChangeEvent, type InputHTMLAttributes } from "react";
import { FolderOpenOutlined } from "@ant-design/icons";
import { App, Button } from "antd";

import type { UploadFolderProgress, UploadFolderResult } from "@/apis/folder-upload";
import { UploadNotificationContent } from "@/components/upload/UploadNotificationContent";
import { useUploadFolder } from "@/hooks/useFolderUpload";
import { clsx as cn } from "clsx";
import {
  getButtonLabel,
  getErrorMessage,
  getProgressDescription,
  getProgressTitle,
  getRootFolderName,
  normalizeProgress,
} from "@/utils/upload-utils";
import classes from "./UploadFoldersButton.module.css";


interface UploadFolderButtonProps {
  parentId?: string | null;
  className?: string;
  disabled?: boolean;
  concurrency?: number;
  variant?: "menu" | "button";
}

type DirectoryInputProps = InputHTMLAttributes<HTMLInputElement> & {
  webkitdirectory?: string;
  directory?: string;
};

const directoryInputProps: DirectoryInputProps = { webkitdirectory: "", directory: "" };

export function UploadFolderButton({
  parentId,
  className,
  disabled = false,
  concurrency = 3,
  variant = "menu",
}: UploadFolderButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<UploadFolderProgress | null>(null);
  const lastProgressKeyRef = useRef("");
  const uploadFolder = useUploadFolder();
  const { notification } = App.useApp();
  const isUploading = uploadFolder.isPending;

  const openFolderPicker = () => {
    if (!disabled && !isUploading) inputRef.current?.click();
  };

  const handleFolderChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = input.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const folderName = getRootFolderName(fileArray);
    const initialProgress: UploadFolderProgress = {
      totalFiles: fileArray.length,
      completedFiles: 0,
      failedFiles: 0,
      percent: 0,
      phase: "creating-folders",
    };

    setProgress(initialProgress);
    lastProgressKeyRef.current = "";
    const notificationKey = `folder-upload-${folderName}-${fileArray.length}`;

    notification.open({
      key: notificationKey,
      message: `Preparing ${folderName}`,
      description: <UploadNotificationContent percent={0} detail={`${fileArray.length} files selected`} />,
      duration: 0,
      placement: "bottomRight",
    });

    uploadFolder.mutate(
      {
        files,
        parentId,
        concurrency,
        onProgress: (nextProgress) => {
          setProgress(nextProgress);
          const normalizedProgress = normalizeProgress(nextProgress);
          const progressKey = [
            normalizedProgress.phase,
            normalizedProgress.percent,
            normalizedProgress.completedFiles,
            normalizedProgress.failedFiles,
            normalizedProgress.currentFileName ?? "",
          ].join(":");
          if (progressKey === lastProgressKeyRef.current) return;
          lastProgressKeyRef.current = progressKey;

          notification.open({
            key: notificationKey,
            message: getProgressTitle(folderName, normalizedProgress),
            description: (
              <UploadNotificationContent
                percent={normalizedProgress.percent}
                detail={getProgressDescription(normalizedProgress)}
              />
            ),
            duration: 0,
            placement: "bottomRight",
          });
        },
      },
      {
        onSuccess: (result: UploadFolderResult) => {
          setProgress(null);
          lastProgressKeyRef.current = "";
          const uploadedCount = result.uploadedFiles.length;
          const createdFolderCount = result.createdFolders.length;
          const failedCount = result.failures.length;
          const description = `${uploadedCount} files uploaded · ${createdFolderCount} folders created${failedCount > 0 ? ` · ${failedCount} files failed` : ""}`;

          if (failedCount > 0) {
            notification.warning({
              key: notificationKey,
              message: "Folder upload completed with warnings",
              description,
              duration: 6,
              placement: "bottomRight",
            });
          } else {
            notification.success({
              key: notificationKey,
              message: "Folder upload complete",
              description,
              duration: 3.5,
              placement: "bottomRight",
            });
          }
          input.value = "";
        },
        onError: (error) => {
          setProgress(null);
          lastProgressKeyRef.current = "";
          notification.error({
            key: notificationKey,
            message: "Folder upload failed",
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
      <input {...directoryInputProps} ref={inputRef} type="file" multiple className={classes.hiddenInput} onChange={handleFolderChange} />
      <Button
        type={variant === "menu" ? "text" : "default"}
        block={variant === "menu"}
        loading={isUploading}
        disabled={disabled || isUploading}
        className={cn(variant === "menu" && classes.button, className)}
        icon={<FolderOpenOutlined />}
        onClick={openFolderPicker}
      >
        {isUploading ? getButtonLabel(progress) : "Folder upload"}
      </Button>
    </>
  );
}
