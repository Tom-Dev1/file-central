import { Download, FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PreviewLinkResponse } from "@/types/file-preview.types";
import { resolvePreviewKind } from "@/utils/resolve-preview-kind";

interface FilePreviewContentProps {
  preview: PreviewLinkResponse;
}

export function FilePreviewContent({ preview }: FilePreviewContentProps) {
  const previewKind = resolvePreviewKind(preview.previewKind, preview.name);
  console.log(`Rendering preview for ${preview.name} with kind ${previewKind} and URL ${preview.url}`);

  switch (previewKind) {
    case "image":
      return (
        <div className="flex size-full items-center justify-center overflow-auto bg-muted/20 p-6">
          <img src={preview.url} alt={preview.name} className="max-h-full max-w-full object-contain" />
        </div>
      );

    case "pdf":
      return (
        <iframe src={preview.url} title={preview.name} className="size-full border-0 bg-background w-full h-full" />
      );

    case "video":
      return (
        <div className="flex size-full items-center justify-center bg-black p-4">
          <video src={preview.url} controls preload="metadata" className="max-h-full max-w-full">
            Your browser does not support video playback.
          </video>
        </div>
      );

    case "audio":
      return (
        <div className="flex size-full items-center justify-center bg-muted/20 p-8">
          <div className="w-full max-w-xl rounded-xl border bg-card p-6">
            <p className="mb-4 truncate text-center font-medium">{preview.name}</p>

            <audio src={preview.url} controls preload="metadata" className="w-full">
              Your browser does not support audio playback.
            </audio>
          </div>
        </div>
      );

    case "text":
      return <iframe src={preview.url} title={preview.name} className="size-full border-0 bg-background" />;

    case "unsupported":
      return (
        <>
          <iframe src={preview.url} title={preview.name} className="size-full border-0 bg-background w-full h-full" />
        </>
      );
    default:
      return (
        <div className="flex size-full items-center justify-center p-6">
          <div className="max-w-md text-center">
            <FileQuestion className="mx-auto size-12 text-muted-foreground" />

            <h3 className="mt-4 font-medium">Preview is not available</h3>

            <p className="mt-2 text-sm text-muted-foreground">This file type cannot be previewed in the browser.</p>

            <div className="mt-5 flex justify-center gap-2">

              <Button asChild>
                <a href={preview.url} download={preview.name}>
                  <Download className="size-4" />
                  Download
                </a>
              </Button>
            </div>
          </div>
        </div>
      );
  }
}
