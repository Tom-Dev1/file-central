import { CheckCircle2, FileUp, LoaderCircle, XCircle } from "lucide-react";

type UploadToastStatus = "uploading" | "success" | "error";

interface UploadProgressToastProps {
  fileName: string;
  progress: number;
  status: UploadToastStatus;
  errorMessage?: string;
}

export function UploadProgressToast({ fileName, progress, status, errorMessage }: UploadProgressToastProps) {
  const normalizedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <div className="w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border bg-background p-4 text-foreground shadow-lg">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {status === "uploading" && <LoaderCircle className="size-5 animate-spin" />}

          {status === "success" && <CheckCircle2 className="size-5 text-emerald-500" />}

          {status === "error" && <XCircle className="size-5 text-destructive" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-medium">
              {status === "uploading" && "Uploading file"}
              {status === "success" && "Upload complete"}
              {status === "error" && "Upload failed"}
            </p>

            {status === "uploading" && (
              <span className="shrink-0 text-xs font-medium text-muted-foreground">{normalizedProgress}%</span>
            )}
          </div>

          <div className="mt-1 flex min-w-0 items-center gap-1.5">
            <FileUp className="size-3.5 shrink-0 text-muted-foreground" />

            <p className="truncate text-xs text-muted-foreground" title={fileName}>
              {fileName}
            </p>
          </div>

          {status !== "error" && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
                style={{
                  width: `${status === "success" ? 100 : normalizedProgress}%`,
                }}
              />
            </div>
          )}

          {status === "error" && (
            <p className="mt-2 text-xs text-destructive">{errorMessage ?? "Unable to upload this file."}</p>
          )}
        </div>
      </div>
    </div>
  );
}
