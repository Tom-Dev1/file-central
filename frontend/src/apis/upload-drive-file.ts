import axios from "axios";

import { uploadApi } from "@/apis/upload.api";
import type { CompletePart, CompleteUploadResponse } from "@/types/upload.types";

const MULTIPART_CONCURRENCY = 3;

export type UploadDriveFilePhase = "initializing" | "uploading" | "completing";

export interface UploadDriveFileProgress {
  phase: UploadDriveFilePhase;
  percent: number;
  uploadedBytes: number;
  totalBytes: number;
}

export interface UploadDriveFileOptions {
  file: File;
  parentId?: string | null;
  signal?: AbortSignal;
  onProgress?: (progress: UploadDriveFileProgress) => void;
}

function createAbortError() {
  return new DOMException("Upload cancelled", "AbortError");
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw createAbortError();
}

function clampPercent(value: number) {
  return Math.min(Math.max(Math.round(value), 0), 100);
}

/**
 * Production upload flow shared with the dashboard buttons.
 * It mirrors /dashboard/test: init -> direct PUT to storage -> complete.
 */
export async function uploadDriveFile({
  file,
  parentId = null,
  signal,
  onProgress,
}: UploadDriveFileOptions): Promise<CompleteUploadResponse> {
  let uploadSessionId: string | undefined;
  let abortPromise: Promise<unknown> | undefined;

  const requestAbort = () => {
    if (!uploadSessionId || abortPromise) return;
    abortPromise = uploadApi.abort(uploadSessionId).catch(() => undefined);
  };

  const handleAbort = () => requestAbort();
  signal?.addEventListener("abort", handleAbort, { once: true });

  const report = (phase: UploadDriveFilePhase, uploadedBytes: number) => {
    const safeUploadedBytes = Math.min(Math.max(uploadedBytes, 0), file.size);
    onProgress?.({
      phase,
      uploadedBytes: safeUploadedBytes,
      totalBytes: file.size,
      percent: file.size === 0 ? 100 : clampPercent((safeUploadedBytes / file.size) * 100),
    });
  };

  try {
    throwIfAborted(signal);
    report("initializing", 0);

    const init = await uploadApi.init({
      name: file.name,
      parentId: parentId?.trim() || null,
      declaredSizeBytes: String(file.size),
      idempotencyKey: crypto.randomUUID(),
      mimeTypeHint: file.type || undefined,
    });

    uploadSessionId = init.uploadSessionId;
    throwIfAborted(signal);
    report("uploading", 0);

    const completedParts: CompletePart[] = [];

    if (init.method === "single") {
      await uploadApi.putToStorage(init.putUrl, file, {
        contentType: file.type || "application/octet-stream",
        signal,
        onProgress: (percent) => report("uploading", file.size * (percent / 100)),
      });
    } else {
      let nextPartIndex = 0;
      const partUploadedBytes = new Map<number, number>();

      const reportMultipartProgress = () => {
        const uploadedBytes = Array.from(partUploadedBytes.values()).reduce((total, bytes) => total + bytes, 0);
        report("uploading", uploadedBytes);
      };

      const worker = async () => {
        while (nextPartIndex < init.partUrls.length) {
          throwIfAborted(signal);
          const part = init.partUrls[nextPartIndex++];
          const start = (part.partNumber - 1) * init.partSizeBytes;
          const chunk = file.slice(start, start + init.partSizeBytes);

          const etag = await uploadApi.putToStorage(part.url, chunk, {
            contentType: file.type || "application/octet-stream",
            signal,
            onProgress: (percent) => {
              partUploadedBytes.set(part.partNumber, chunk.size * (percent / 100));
              reportMultipartProgress();
            },
          });

          partUploadedBytes.set(part.partNumber, chunk.size);
          completedParts.push({
            partNumber: part.partNumber,
            etag,
            sizeBytes: String(chunk.size),
          });
          reportMultipartProgress();
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(MULTIPART_CONCURRENCY, init.partUrls.length) }, () => worker())
      );
    }

    throwIfAborted(signal);
    report("completing", file.size);

    const result = await uploadApi.complete(uploadSessionId, {
      parts:
        init.method === "multipart"
          ? completedParts.sort((left, right) => left.partNumber - right.partNumber)
          : undefined,
    });

    report("completing", file.size);
    return result;
  } catch (error) {
    requestAbort();
    await abortPromise;

    if (signal?.aborted || axios.isCancel(error)) throw createAbortError();
    throw error;
  } finally {
    signal?.removeEventListener("abort", handleAbort);
  }
}
