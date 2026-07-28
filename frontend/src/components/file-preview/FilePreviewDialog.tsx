// components/file-preview/FilePreviewDialog.tsx

import { ExternalLink, LoaderCircle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DriveItem } from "@/types/api.types";

import { FilePreviewContent } from "./FilePreviewContent";
import { useFilePreviewLink } from "@/hooks/useFiles";

interface FilePreviewDialogProps {
  item: DriveItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FilePreviewDialog({ item, open, onOpenChange }: FilePreviewDialogProps) {
  const previewMutation = useFilePreviewLink();

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);

    if (nextOpen && !previewMutation.isPending) {
      previewMutation.mutate(item.id);
    }

    if (!nextOpen) {
      previewMutation.reset();
    }
  };

  const handleRetry = () => {
    previewMutation.mutate(item.id);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[90vh] w-[95vw] max-w-[95vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[95vw]">
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-14">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate">{item.name}</DialogTitle>

              <DialogDescription className="mt-1 truncate">
                {previewMutation.data?.mimeType ?? item.mimeType ?? "Unknown file type"}
              </DialogDescription>
            </div>

            {previewMutation.data && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Open file in a new tab"
                onClick={() => {
                  window.open(previewMutation.data.url, "_blank", "noopener,noreferrer");
                }}
              >
                <ExternalLink className="size-4" />
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden">
          {previewMutation.isPending ? (
            <div className="flex size-full flex-col items-center justify-center">
              <LoaderCircle className="size-8 animate-spin text-primary" />

              <p className="mt-3 text-sm text-muted-foreground">Preparing preview...</p>
            </div>
          ) : previewMutation.isError ? (
            <div className="flex size-full items-center justify-center p-6">
              <div className="text-center">
                <h3 className="font-medium">Unable to open preview</h3>

                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  The preview link could not be created. Please try again.
                </p>

                <Button type="button" variant="outline" className="mt-4" onClick={handleRetry}>
                  <RotateCcw className="size-4" />
                  Try again
                </Button>
              </div>
            </div>
          ) : previewMutation.data ? (
            <FilePreviewContent preview={previewMutation.data} />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
