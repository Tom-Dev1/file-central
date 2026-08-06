import { useRef, type ChangeEvent } from "react";
import { UploadOutlined } from "@ant-design/icons";
import { toast } from "sonner";
import { Button } from "antd";
import { useUploadFile } from "@/hooks";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/constants/file-constants";
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
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    lastProgressRef.current = -1;

    const toastId = toast.loading(`Uploading ${file.name} — 0%`, {
      duration: Infinity,
    });

    uploadFile.mutate(
      {
        file,
        parentId,

        onProgress: (progress) => {
          if (progress === lastProgressRef.current) {
            return;
          }

          lastProgressRef.current = progress;

          const uploadedBytes = file.size * (progress / 100);

          toast.loading(`Uploading ${file.name} — ${progress}%`, {
            id: toastId,
            duration: Infinity,
            description: `${formatFileSize(uploadedBytes)} of ${formatFileSize(file.size)}`,
          });
        },
      },
      {
        onSuccess: () => {
          toast.success("Upload complete", {
            id: toastId,
            description: file.name,
            duration: 3000,
          });

          input.value = "";
        },

        onError: (error) => {
          toast.error("Upload failed", {
            id: toastId,
            description: getErrorMessage(error),
            duration: 5000,
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
