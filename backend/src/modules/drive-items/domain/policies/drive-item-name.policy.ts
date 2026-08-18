import { ConflictException, Injectable } from "@nestjs/common";

@Injectable()
export class DriveItemNamePolicy {
  normalize(name: string): string {
    return name
      .normalize("NFC")
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase("en-US");
  }

  extractExtension(name: string): string | null {
    const index = name.lastIndexOf(".");
    return index > 0 ? name.slice(index + 1).toLowerCase() : null;
  }

  createCopyName(originalName: string, copyNumber: number): string {
    if (copyNumber === 0) return originalName;
    const extensionIndex = originalName.lastIndexOf(".");
    const stem = extensionIndex > 0 ? originalName.slice(0, extensionIndex) : originalName;
    const extension = extensionIndex > 0 ? originalName.slice(extensionIndex) : "";
    const suffix = `(${copyNumber})`;
    const safeExtension = extension.slice(0, Math.max(0, 255 - suffix.length - 1));
    const maxStemLength = Math.max(1, 255 - suffix.length - safeExtension.length);
    return `${stem.slice(0, maxStemLength)}${suffix}${safeExtension}`;
  }

  createFolderCopyName(originalName: string, copyNumber: number): string {
    if (copyNumber === 0) return originalName;
    const suffix = ` (${copyNumber})`;
    const maxNameLength = Math.max(1, 255 - suffix.length);
    return `${originalName.slice(0, maxNameLength).trimEnd()}${suffix}`;
  }

  isDuplicateKeyError(error: unknown): error is { code: number } {
    return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
  }

  rethrowDuplicate(error: unknown, code = "NAME_ALREADY_EXISTS"): never {
    if (this.isDuplicateKeyError(error)) throw new ConflictException(code);
    throw error;
  }
}
