import axios from "axios";

import { uploadApi } from "@/apis/upload.api";
import { ApiError } from "@/lib/api-error";
import type {
  CompletePart,
  CompleteUploadResponse,
  InitUploadResponse,
  PartUrl,
  UploadMethod,
  UploadStatusResponse,
} from "@/types/upload.types";

const MULTIPART_CONCURRENCY = 3;

export type UploadDriveFilePhase = "initializing" | "uploading" | "completing";

export interface UploadDriveFileProgress {
  phase: UploadDriveFilePhase;
  percent: number;
  uploadedBytes: number;
  totalBytes: number;
}

export interface UploadDriveFileState {
  idempotencyKey: string;
  uploadSessionId?: string;
}

export interface UploadDriveFileOptions {
  file: File;
  parentId?: string | null;
  signal?: AbortSignal;
  state?: UploadDriveFileState;
  onProgress?: (progress: UploadDriveFileProgress) => void;
}

export function createUploadDriveFileState(): UploadDriveFileState {
  return { idempotencyKey: crypto.randomUUID() };
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

function resetUploadState(state: UploadDriveFileState) {
  state.idempotencyKey = crypto.randomUUID();
  state.uploadSessionId = undefined;
}

function isTerminalSessionError(error: unknown) {
  if (!(error instanceof ApiError)) return false;
  return error.messages.some(
    (message) =>
      message === "UPLOAD_SESSION_NOT_FOUND" ||
      message === "UPLOAD_SESSION_EXPIRED" ||
      message.startsWith("UPLOAD_SESSION_NOT_RESUMABLE:"),
  );
}

/** A task owns one mutable state object so retries resume its existing session. */
export async function uploadDriveFile({
  file,
  parentId = null,
  signal,
  state: providedState,
  onProgress,
}: UploadDriveFileOptions): Promise<CompleteUploadResponse> {
  const canResume = providedState !== undefined;
  const state = providedState ?? createUploadDriveFileState();
  let pausePromise: Promise<unknown> | undefined;
  let abortPromise: Promise<unknown> | undefined;

  const requestPause = () => {
    if (!state.uploadSessionId || pausePromise) return;
    pausePromise = uploadApi.pause(state.uploadSessionId).catch(() => undefined);
  };
  const requestAbort = () => {
    if (!state.uploadSessionId || abortPromise) return;
    abortPromise = uploadApi.abort(state.uploadSessionId);
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

    let method: UploadMethod = "single";
    let singlePutUrl: string | undefined;
    let partSizeBytes: number | undefined;
    let partUrls: PartUrl[] = [];
    let completedParts: CompletePart[] = [];

    if (state.uploadSessionId) {
      let status: UploadStatusResponse | undefined;
      try {
        status = await uploadApi.status(state.uploadSessionId);
      } catch (error) {
        if (!isTerminalSessionError(error)) throw error;
        if (
          error instanceof ApiError &&
          error.messages.some((message) => message === "UPLOAD_SESSION_NOT_RESUMABLE:aborted")
        ) {
          await uploadApi.abort(state.uploadSessionId);
        }
        resetUploadState(state);
      }

      if (status) {
        if (status.status === "completed" && status.driveItemId) {
          return { driveItemId: status.driveItemId, status: status.status };
        }
        if (status.status === "processing") {
          throw new Error("Upload is still processing. Retry shortly.");
        }
        if (!status.method) throw new Error("Upload status is missing its method.");

        method = status.method;
        if (method === "single") {
          singlePutUrl = status.singlePartUploaded ? undefined : status.putUrl;
          if (!status.singlePartUploaded && !singlePutUrl) {
            throw new Error("Upload status did not provide a single-part URL.");
          }
        } else {
          if (!status.partSizeBytes) throw new Error("Upload status is missing its part size.");
          partSizeBytes = status.partSizeBytes;
          partUrls = status.missingPartUrls ?? [];
          completedParts = (status.uploadedParts ?? []).map((part) => ({ ...part }));
        }
      }
    }

    if (!state.uploadSessionId) {
      const init: InitUploadResponse = await uploadApi.init({
        name: file.name,
        parentId: parentId?.trim() || null,
        declaredSizeBytes: String(file.size),
        idempotencyKey: state.idempotencyKey,
        mimeTypeHint: file.type || undefined,
      });
      state.uploadSessionId = init.uploadSessionId;
      method = init.method;
      if (init.method === "single") {
        singlePutUrl = init.putUrl;
      } else {
        partSizeBytes = init.partSizeBytes;
        partUrls = init.partUrls;
      }
    }

    throwIfAborted(signal);
    report("uploading", completedParts.reduce((total, part) => total + Number(part.sizeBytes), 0));

    if (method === "single") {
      if (singlePutUrl) {
        await uploadApi.putToStorage(singlePutUrl, file, {
          contentType: file.type || "application/octet-stream",
          signal,
          onProgress: (percent) => report("uploading", file.size * (percent / 100)),
        });
      }
    } else {
      if (!partSizeBytes) throw new Error("Multipart upload is missing its part size.");
      const safePartSizeBytes = partSizeBytes;
      let nextPartIndex = 0;
      const partUploadedBytes = new Map<number, number>(
        completedParts.map((part) => [part.partNumber, Number(part.sizeBytes)]),
      );
      const reportMultipartProgress = () => {
        report(
          "uploading",
          Array.from(partUploadedBytes.values()).reduce((total, bytes) => total + bytes, 0),
        );
      };

      const worker = async () => {
        while (nextPartIndex < partUrls.length) {
          throwIfAborted(signal);
          const part = partUrls[nextPartIndex++];
          const start = (part.partNumber - 1) * safePartSizeBytes;
          const chunk = file.slice(start, start + safePartSizeBytes);
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
        Array.from({ length: Math.min(MULTIPART_CONCURRENCY, partUrls.length) }, () => worker()),
      );
    }

    throwIfAborted(signal);
    report("completing", file.size);
    const result = await uploadApi.complete(state.uploadSessionId, {
      parts:
        method === "multipart"
          ? completedParts.sort((left, right) => left.partNumber - right.partNumber)
          : undefined,
    });
    report("completing", file.size);
    return result;
  } catch (error) {
    if (signal?.aborted || axios.isCancel(error)) {
      requestAbort();
      try {
        await abortPromise;
        resetUploadState(state);
      } catch {
        // Keep the session id so a later retry can finish abort cleanup.
      }
      throw createAbortError();
    }

    if (state.uploadSessionId && canResume) {
      requestPause();
      await pausePromise;
    } else if (state.uploadSessionId) {
      requestAbort();
      await abortPromise;
    } else {
      state.idempotencyKey = crypto.randomUUID();
    }
    throw error;
  } finally {
    signal?.removeEventListener("abort", handleAbort);
  }
}
