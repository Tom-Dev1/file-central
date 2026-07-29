import { useRef, type ChangeEvent } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useUploadFile } from "@/hooks";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/constants/file-constants";
import { getErrorMessage } from "@/utils/upload-utils";

interface UploadFileButtonProps {
  parentId?: string | null;
  className?: string;
}

export function UploadFileButton({ parentId, className }: UploadFileButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const lastProgressRef = useRef(-1);
  const uploadFile = useUploadFile();
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    console.log(`file,`, file);

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
        type="button"
        variant="secondary"
        size="lg"
        disabled={uploadFile.isPending}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "w-full justify-start border-0 bg-transparent shadow-none",
          "hover:bg-accent cursor-pointer",
          className
        )}
      >
        <Upload className="mr-2 size-4" />

        {uploadFile.isPending ? "Uploading..." : "File upload"}
      </Button>
    </>
  );
}
