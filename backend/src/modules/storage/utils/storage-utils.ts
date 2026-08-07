import { StorageProvider } from "../enums/storage-object.enum";

const STORAGE_PROVIDER_VALUES = new Set<string>(Object.values(StorageProvider));

export function isStorageProvider(value: unknown): value is StorageProvider {
  return typeof value === "string" && STORAGE_PROVIDER_VALUES.has(value);
}

export function parseStorageProvider(
  value: string | undefined,
  fallback: StorageProvider = StorageProvider.MINIO
): StorageProvider {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (!isStorageProvider(normalized)) {
    throw new Error(`Unsupported storage provider "${value}". Expected local, minio, or s3.`);
  }

  return normalized;
}
