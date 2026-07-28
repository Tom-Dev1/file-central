import { UploadProgressToast } from "@/components/UploadProgressToast";
import { toast } from "sonner";

interface UploadToastOptions {
  toastId: string | number;
  fileName: string;
  progress?: number;
  errorMessage?: string;
}

export function showUploadProgress({ toastId, fileName, progress = 0 }: UploadToastOptions) {
  toast.custom(() => <UploadProgressToast fileName={fileName} progress={progress} status="uploading" />, {
    id: toastId,
    duration: Infinity,
  });
}

export function showUploadSuccess({ toastId, fileName }: UploadToastOptions) {
  toast.custom(() => <UploadProgressToast fileName={fileName} progress={100} status="success" />, {
    id: toastId,
    duration: 3000,
  });
}

export function showUploadError({ toastId, fileName, errorMessage }: UploadToastOptions) {
  toast.custom(
    () => <UploadProgressToast fileName={fileName} progress={0} status="error" errorMessage={errorMessage} />,
    {
      id: toastId,
      duration: 5000,
    }
  );
}
