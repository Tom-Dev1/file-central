import { useEffect } from "react";
import { ExternalLink, LoaderCircle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFilePreviewLink } from "@/hooks/useFiles";
import type { DriveItem } from "@/types/api.types";

import { FilePreviewContent } from "./FilePreviewContent";

interface FilePreviewDialogProps {
  item: DriveItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FilePreviewDialog({ item, open, onOpenChange }: FilePreviewDialogProps) {
  const previewMutation = useFilePreviewLink();

  const { mutate, reset, data, isPending, isError } = previewMutation;

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }

    mutate(item.id);
  }, [open, item.id, mutate, reset]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);

    if (!nextOpen) {
      reset();
    }
  };

  const handleRetry = () => {
    reset();
    mutate(item.id);
  };

  // const handleOpenInNewTab = () => {
  //   if (!data?.url) {
  //     return;
  //   }

  //   // window.open(data.url, "_blank", "noopener,noreferrer");
  // };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[90vh] w-[95vw] max-w-[95vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[95vw]">
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-14">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate">{item.name}</DialogTitle>

              <DialogDescription className="mt-1 truncate">
                {item.mimeType ?? "Unknown file type"}
              </DialogDescription>
            </div>

            {data?.url && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Open file in a new tab"
                // onClick={handleOpenInNewTab}
              >
                <ExternalLink className="size-4" />
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden">
          {isPending ? (
            <div className="flex size-full flex-col items-center justify-center">
              <LoaderCircle className="size-8 animate-spin text-primary" />

              <p className="mt-3 text-sm text-muted-foreground">Preparing preview...</p>
            </div>
          ) : isError ? (
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
          ) : data ? (
            <FilePreviewContent preview={data} fileName={item.name} />
          ) : (
            <div className="flex size-full items-center justify-center">
              <p className="text-sm text-muted-foreground">No preview data is available.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
