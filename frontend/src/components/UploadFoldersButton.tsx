import { useRef, type ChangeEvent, type InputHTMLAttributes } from "react";
import { FolderOpenOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { clsx as cn } from "clsx";

import { useUploadManager } from "@/hooks/useUploadManager";
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
  const { startFolder } = useUploadManager();

  const handleFolderChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    if (!input.files?.length) return;

    startFolder(input.files, parentId, concurrency);
    input.value = "";
  };

  return (
    <>
      <input
        {...directoryInputProps}
        ref={inputRef}
        type="file"
        multiple
        className={classes.hiddenInput}
        onChange={handleFolderChange}
      />
      <Button
        type={variant === "menu" ? "text" : "default"}
        block={variant === "menu"}
        disabled={disabled}
        className={cn(variant === "menu" && classes.button, className)}
        icon={<FolderOpenOutlined />}
        onClick={() => inputRef.current?.click()}
      >
        Folder upload
      </Button>
    </>
  );
}
