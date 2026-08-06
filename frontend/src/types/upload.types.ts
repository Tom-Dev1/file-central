export type UploadMethod = "single" | "multipart";

export interface InitUploadRequest {
  name: string;
  parentId: string | null;
  declaredSizeBytes: string; // Int64 -> string
  idempotencyKey: string;
  mimeTypeHint?: string;
  declaredChecksumSha256Hex?: string;
}

export interface PartUrl {
  partNumber: number;
  url: string;
}

// Response init có 2 dạng theo method.
export interface InitSingleResponse {
  uploadSessionId: string;
  method: "single";
  putUrl: string;
  expiresAt: string;
}

export interface InitMultipartResponse {
  uploadSessionId: string;
  method: "multipart";
  partSizeBytes: number;
  expectedPartsCount: number;
  partUrls: PartUrl[];
  expiresAt: string;
}

export type InitUploadResponse = InitSingleResponse | InitMultipartResponse;

export interface UploadedPart {
  partNumber: number;
  etag: string;
  sizeBytes: string;
}

export interface UploadStatusResponse {
  status: string;
  driveItemId?: string;
  singlePartUploaded?: boolean;
  totalParts?: number;
  uploadedPartCount?: number;
  uploadedParts?: UploadedPart[];
  missingPartUrls?: PartUrl[];
  partSizeBytes?: number;
}

export interface CompletePart {
  partNumber: number;
  etag: string;
  sizeBytes: string;
}

export interface CompleteUploadRequest {
  parts?: CompletePart[];
  clientChecksumSha256Hex?: string;
}

export interface CompleteUploadResponse {
  driveItemId: string;
  status: string;
}
