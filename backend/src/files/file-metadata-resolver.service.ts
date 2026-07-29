import { BadRequestException, Injectable } from "@nestjs/common";
import { loadEsm } from "load-esm";
import { lookup as lookupMimeType } from "mime-types";
import { basename, extname } from "node:path";

export type MimeSource = "signature" | "text-extension" | "extension" | "client" | "fallback";

export interface ResolvedFileMetadata {
  name: string;

  /**
   * Extension supplied in the uploaded filename.
   */
  extension: string | null;

  mimeType: string;
  clientMimeType: string | null;
  detectedMimeType: string | null;
  detectedExtension: string | null;
  mimeSource: MimeSource;

  /**
   * True when the binary content does not match the filename extension.
   */
  extensionMismatch: boolean;
}

interface FileTypeResult {
  ext: string;
  mime: string;
}

const MAX_FILE_NAME_LENGTH = 255;

const TEXT_MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  txt: "text/plain",
  md: "text/markdown",
  log: "text/plain",

  ts: "text/typescript",
  tsx: "text/typescript",
  js: "text/javascript",
  jsx: "text/javascript",

  json: "application/json",
  xml: "application/xml",
  csv: "text/csv",

  html: "text/html",
  htm: "text/html",
  css: "text/css",
  scss: "text/x-scss",
  less: "text/x-less",

  py: "text/x-python",
  java: "text/x-java-source",
  c: "text/x-c",
  cpp: "text/x-c++src",
  h: "text/x-c",
  hpp: "text/x-c++hdr",
  cs: "text/x-csharp",
  go: "text/x-go",
  rs: "text/x-rust",

  yaml: "application/yaml",
  yml: "application/yaml",

  sql: "application/sql",
  sh: "application/x-sh",
  bat: "text/plain",
  ps1: "text/plain",

  env: "text/plain",
  gitignore: "text/plain",
};

const TEXT_MIME_BY_FILE_NAME: Readonly<Record<string, string>> = {
  ".env": "text/plain",
  ".gitignore": "text/plain",
  ".npmignore": "text/plain",
  ".dockerignore": "text/plain",
  dockerfile: "text/plain",
  makefile: "text/plain",
  procfile: "text/plain",
};

const EQUIVALENT_EXTENSIONS: Readonly<Record<string, readonly string[]>> = {
  jpg: ["jpg", "jpeg"],
  jpeg: ["jpg", "jpeg"],
  tif: ["tif", "tiff"],
  tiff: ["tif", "tiff"],
  gz: ["gz", "gzip"],
  gzip: ["gz", "gzip"],
  oga: ["oga", "ogg"],
  ogv: ["ogv", "ogg"],
};

@Injectable()
export class FileMetadataResolverService {
  private fileTypeModulePromise: Promise<typeof import("file-type")> | undefined;

  async resolve(file: Express.Multer.File): Promise<ResolvedFileMetadata> {
    if (!file) {
      throw new BadRequestException("File is required.");
    }

    const name = this.normalizeFileName(file.originalname);
    const extension = this.extractExtension(name);
    const clientMimeType = this.normalizeMimeType(file.mimetype);
    const detectedType = await this.detectBinaryType(file.buffer);

    /*
     * A binary signature is the strongest available evidence.
     */
    if (detectedType) {
      const detectedExtension = detectedType.ext.toLowerCase();
      const detectedMimeType = this.normalizeMimeType(detectedType.mime);

      if (!detectedMimeType) {
        throw new BadRequestException("The detected file MIME type is invalid.");
      }

      return {
        name,
        extension,
        mimeType: detectedMimeType,
        clientMimeType,
        detectedMimeType,
        detectedExtension,
        mimeSource: "signature",
        extensionMismatch: this.hasExtensionMismatch(extension, detectedExtension),
      };
    }

    /*
     * Dotfiles such as .env do not have a regular extension.
     */
    const exactFileNameMimeType = TEXT_MIME_BY_FILE_NAME[name.toLowerCase()];

    if (exactFileNameMimeType) {
      return {
        name,
        extension,
        mimeType: exactFileNameMimeType,
        clientMimeType,
        detectedMimeType: null,
        detectedExtension: null,
        mimeSource: "text-extension",
        extensionMismatch: false,
      };
    }

    /*
     * Text and source-code files usually do not have binary signatures.
     */
    if (extension) {
      const textMimeType = TEXT_MIME_BY_EXTENSION[extension];

      if (textMimeType) {
        return {
          name,
          extension,
          mimeType: textMimeType,
          clientMimeType,
          detectedMimeType: null,
          detectedExtension: null,
          mimeSource: "text-extension",
          extensionMismatch: false,
        };
      }
    }

    const extensionMimeType = this.normalizeMimeType(lookupMimeType(name) || undefined);

    if (extensionMimeType) {
      return {
        name,
        extension,
        mimeType: extensionMimeType,
        clientMimeType,
        detectedMimeType: null,
        detectedExtension: null,
        mimeSource: "extension",
        extensionMismatch: false,
      };
    }

    /*
     * Client MIME is only a weak fallback and must not be used as
     * proof that a file is safe.
     */
    if (clientMimeType && clientMimeType !== "application/octet-stream") {
      return {
        name,
        extension,
        mimeType: clientMimeType,
        clientMimeType,
        detectedMimeType: null,
        detectedExtension: null,
        mimeSource: "client",
        extensionMismatch: false,
      };
    }

    return {
      name,
      extension,
      mimeType: "application/octet-stream",
      clientMimeType,
      detectedMimeType: null,
      detectedExtension: null,
      mimeSource: "fallback",
      extensionMismatch: false,
    };
  }

  private async detectBinaryType(buffer?: Buffer): Promise<FileTypeResult | null> {
    if (!buffer?.length) {
      return null;
    }

    const fileTypeModule = await this.getFileTypeModule();
    const result = await fileTypeModule.fileTypeFromBuffer(buffer);

    if (!result) {
      return null;
    }

    return {
      ext: result.ext.toLowerCase(),
      mime: result.mime.toLowerCase(),
    };
  }

  private getFileTypeModule(): Promise<typeof import("file-type")> {
    this.fileTypeModulePromise ??= loadEsm<typeof import("file-type")>("file-type");

    return this.fileTypeModulePromise;
  }

  private normalizeFileName(originalName?: string): string {
    if (typeof originalName !== "string") {
      throw new BadRequestException("File name is required.");
    }

    const normalized = originalName.normalize("NFKC").replace(/\0/g, "").replace(/\\/g, "/");

    const fileName = basename(normalized).trim();

    if (!fileName || fileName === "." || fileName === "..") {
      throw new BadRequestException("File name is required.");
    }

    if (/[\u0000-\u001F\u007F]/u.test(fileName)) {
      throw new BadRequestException("File name contains invalid characters.");
    }

    if (Buffer.byteLength(fileName, "utf8") > MAX_FILE_NAME_LENGTH) {
      throw new BadRequestException(`File name must not exceed ${MAX_FILE_NAME_LENGTH} bytes.`);
    }

    return fileName;
  }

  private extractExtension(fileName: string): string | null {
    const extension = extname(fileName).slice(1).trim().toLowerCase();

    return extension || null;
  }

  private normalizeMimeType(mimeType?: string): string | null {
    const normalized = mimeType?.split(";", 1)[0]?.trim().toLowerCase();

    return normalized || null;
  }

  private hasExtensionMismatch(uploadedExtension: string | null, detectedExtension: string): boolean {
    if (!uploadedExtension) {
      return true;
    }

    const equivalentExtensions = EQUIVALENT_EXTENSIONS[detectedExtension] ?? [detectedExtension];

    return !equivalentExtensions.includes(uploadedExtension);
  }
}
