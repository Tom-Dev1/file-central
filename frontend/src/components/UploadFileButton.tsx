import { useRef, type ChangeEvent } from "react";
import { UploadOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { clsx as cn } from "clsx";

import { useUploadManager } from "@/hooks/useUploadManager";
import styles from "./UploadFileButton.module.css";

interface UploadFileButtonProps {
  parentId?: string | null;
  className?: string;
  variant?: "menu" | "button";
}

export function UploadFileButton({ parentId, className, variant = "menu" }: UploadFileButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { startFiles } = useUploadManager();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    if (!input.files?.length) return;

    startFiles(input.files, parentId);
    input.value = "";
  };

  return (
    <>
      <input ref={inputRef} type="file" multiple className={styles.input} onChange={handleFileChange} />
      <Button
        type={variant === "menu" ? "text" : "default"}
        block={variant === "menu"}
        onClick={() => inputRef.current?.click()}
        className={cn(variant === "menu" && styles.menuButton, className)}
        icon={<UploadOutlined />}
      >
        File upload
      </Button>
    </>
  );
}
