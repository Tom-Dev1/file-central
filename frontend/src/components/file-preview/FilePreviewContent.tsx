import { Download, ExternalLink, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PreviewLinkResponse } from "@/types/file-preview.types";
import { resolvePreviewKind } from "@/utils/resolve-preview-kind";

interface FilePreviewContentProps {
  preview: PreviewLinkResponse;
  fileName: string;
}

export function FilePreviewContent({ preview, fileName }: FilePreviewContentProps) {
  switch (resolvePreviewKind(fileName)) {
    case "image": return <div className="flex size-full items-center justify-center overflow-auto bg-muted/20 p-6"><img src={preview.url} alt={fileName} className="max-h-full max-w-full object-contain" /></div>;
    case "pdf": return <iframe src={preview.url} title={fileName} className="size-full border-0 bg-background" />;
    case "video": return <div className="flex size-full items-center justify-center bg-black p-4"><video src={preview.url} controls preload="metadata" className="max-h-full max-w-full" /></div>;
    case "audio": return <div className="flex size-full items-center justify-center bg-muted/20 p-8"><div className="w-full max-w-xl rounded-xl border bg-card p-6"><p className="mb-4 truncate text-center font-medium">{fileName}</p><audio src={preview.url} controls preload="metadata" className="w-full" /></div></div>;
    case "text": return <iframe src={preview.url} title={fileName} className="size-full border-0 bg-background" />;
    default: return <div className="flex size-full items-center justify-center p-6"><div className="max-w-md text-center"><FileQuestion className="mx-auto size-12 text-muted-foreground" /><h3 className="mt-4 font-medium">Preview is not available</h3><p className="mt-2 text-sm text-muted-foreground">This file type cannot be previewed in the browser.</p><div className="mt-5 flex justify-center gap-2"><Button type="button" variant="outline" onClick={() => window.open(preview.url, "_blank", "noopener,noreferrer")}><ExternalLink className="size-4" />Open file</Button><Button asChild><a href={preview.url} download={fileName}><Download className="size-4" />Download</a></Button></div></div></div>;
  }
}