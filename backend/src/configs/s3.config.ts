import { registerAs } from "@nestjs/config";

export const S3_CONFIG_TOKEN = "s3";

export interface S3ConfigShape {
  endpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  forcePathStyle: boolean;
  presignExpiresSeconds: number;
}

function minioEndpoint(): string {
  const host = process.env.MINIO_ENDPOINT ?? "localhost";
  const port = process.env.MINIO_PORT ?? "9000";
  const protocol = process.env.MINIO_USE_SSL === "true" ? "https" : "http";
  return host.startsWith("http://") || host.startsWith("https://")
    ? host
    : `${protocol}://${host}:${port}`;
}

export const s3Config = registerAs<S3ConfigShape>(S3_CONFIG_TOKEN, () => ({
  endpoint: process.env.STORAGE_ENDPOINT ?? process.env.S3_ENDPOINT ?? minioEndpoint(),
  region: process.env.STORAGE_REGION ?? process.env.S3_REGION ?? "us-east-1",
  accessKey:
    process.env.STORAGE_ACCESS_KEY ??
    process.env.S3_ACCESS_KEY ??
    process.env.MINIO_ACCESS_KEY ??
    "minioadmin",
  secretKey:
    process.env.STORAGE_SECRET_KEY ??
    process.env.S3_SECRET_KEY ??
    process.env.MINIO_SECRET_KEY ??
    "minioadmin",
  bucket:
    process.env.STORAGE_BUCKET ??
    process.env.S3_BUCKET ??
    process.env.MINIO_BUCKET ??
    "file-central",
  forcePathStyle:
    (process.env.STORAGE_FORCE_PATH_STYLE ?? process.env.S3_FORCE_PATH_STYLE ?? "true") === "true",
  presignExpiresSeconds: Number(
    process.env.STORAGE_PRESIGN_EXPIRES_SECONDS ??
      process.env.S3_PRESIGN_EXPIRES_SECONDS ??
      3600,
  ),
}));
