import { useRef, useState, type ChangeEvent, type InputHTMLAttributes } from "react";

import { FolderOpenOutlined } from "@ant-design/icons";
import { toast } from "sonner";

import { Button } from "antd";
import { cn } from "@/lib/utils";
import { useUploadFolder } from "@/hooks/useFolderUpload";
import type { UploadFolderProgress, UploadFolderResult } from "@/apis/folder-upload";
import {
  getButtonLabel,
  getErrorMessage,
  getProgressDescription,
  getProgressTitle,
  getRootFolderName,
  normalizeProgress,
} from "@/utils/upload-utils";

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

const directoryInputProps: DirectoryInputProps = {
  webkitdirectory: "",
  directory: "",
};

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

  const isUploading = uploadFolder.isPending;

  const openFolderPicker = () => {
    if (disabled || isUploading) {
      return;
    }

    inputRef.current?.click();
  };

  const handleFolderChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = input.files;

    if (!files || files.length === 0) {
      return;
    }

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

    const toastId = toast.loading(`Preparing ${folderName}`, {
      description: `${fileArray.length} files selected`,
      duration: Infinity,
    });

    uploadFolder.mutate(
      {
        files,
        parentId,
        concurrency,

        onProgress: (nextProgress: UploadFolderProgress) => {
          setProgress(nextProgress);

          const normalizedProgress = normalizeProgress(nextProgress);

          const progressKey = [
            normalizedProgress.phase,
            normalizedProgress.percent,
            normalizedProgress.completedFiles,
            normalizedProgress.failedFiles,
            normalizedProgress.currentFileName ?? "",
          ].join(":");

          if (progressKey === lastProgressKeyRef.current) {
            return;
          }

          lastProgressKeyRef.current = progressKey;

          toast.loading(getProgressTitle(folderName, normalizedProgress), {
            id: toastId,
            duration: Infinity,
            description: getProgressDescription(normalizedProgress),
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

          if (failedCount > 0) {
            toast.warning("Folder upload completed with warnings", {
              id: toastId,
              duration: 6000,
              description: `${uploadedCount} files uploaded · ${createdFolderCount} folders created · ${failedCount} files failed`,
            });
          } else {
            toast.success("Folder upload complete", {
              id: toastId,
              duration: 3500,
              description: `${uploadedCount} files uploaded · ${createdFolderCount} folders created`,
            });
          }

          input.value = "";
        },

        onError: (error) => {
          setProgress(null);
          lastProgressKeyRef.current = "";

          toast.error("Folder upload failed", {
            id: toastId,
            duration: 5000,
            description: getErrorMessage(error),
          });

          input.value = "";
        },
      }
    );
  };

  return (
    <>
      <input
        {...directoryInputProps}
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFolderChange}
      />

      <Button
        type={variant === "menu" ? "text" : "default"}
        block={variant === "menu"}
        loading={isUploading}
        disabled={disabled || isUploading}
        className={cn(variant === "menu" && "justify-start", className)}
        icon={<FolderOpenOutlined />}
        onClick={openFolderPicker}
      >
        {isUploading ? getButtonLabel(progress) : "Folder upload"}
      </Button>
    </>
  );
}
