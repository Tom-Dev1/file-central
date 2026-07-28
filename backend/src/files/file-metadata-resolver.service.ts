import { BadRequestException, Injectable } from "@nestjs/common";
import { loadEsm } from "load-esm";
import { lookup as lookupMimeType } from "mime-types";
import { basename, extname } from "node:path";

export type MimeSource = "signature" | "text-extension" | "extension" | "client" | "fallback";

export interface ResolvedFileMetadata {
  name: string;
  extension: string | null;
  mimeType: string;
  clientMimeType: string | null;
  detectedMimeType: string | null;
  detectedExtension: string | null;
  mimeSource: MimeSource;
}

interface FileTypeResult {
  ext: string;
  mime: string;
}

const TEXT_MIME_BY_EXTENSION: Record<string, string> = {
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

@Injectable()
export class FileMetadataResolverService {
  private fileTypeModulePromise: Promise<typeof import("file-type")> | undefined;

  async resolve(file: Express.Multer.File): Promise<ResolvedFileMetadata> {
    const name = this.normalizeFileName(file.originalname);

    const extension = this.extractExtension(name);

    const clientMimeType = this.normalizeMimeType(file.mimetype);

    const detectedType = await this.detectBinaryType(file.buffer);

    /*
     * Binary signature has the highest priority.
     * It prevents renamed binary files from being trusted
     * only because of their filename extension.
     */
    if (detectedType) {
      return {
        name,
        extension,
        mimeType: detectedType.mime,
        clientMimeType,
        detectedMimeType: detectedType.mime,
        detectedExtension: detectedType.ext,
        mimeSource: "signature",
      };
    }

    /*
     * Text and source-code files usually do not have
     * recognizable binary signatures.
     */
    if (extension && TEXT_MIME_BY_EXTENSION[extension]) {
      return {
        name,
        extension,
        mimeType: TEXT_MIME_BY_EXTENSION[extension],
        clientMimeType,
        detectedMimeType: null,
        detectedExtension: null,
        mimeSource: "text-extension",
      };
    }

    const extensionMimeType = lookupMimeType(name);

    if (typeof extensionMimeType === "string") {
      return {
        name,
        extension,
        mimeType: extensionMimeType,
        clientMimeType,
        detectedMimeType: null,
        detectedExtension: null,
        mimeSource: "extension",
      };
    }

    if (clientMimeType && clientMimeType !== "application/octet-stream") {
      return {
        name,
        extension,
        mimeType: clientMimeType,
        clientMimeType,
        detectedMimeType: null,
        detectedExtension: null,
        mimeSource: "client",
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
    };
  }

  private async detectBinaryType(buffer?: Buffer): Promise<FileTypeResult | null> {
    if (!buffer || buffer.length === 0) {
      return null;
    }

    const module = await this.getFileTypeModule();

    const result = await module.fileTypeFromBuffer(buffer);

    if (!result) {
      return null;
    }

    return {
      ext: result.ext,
      mime: result.mime,
    };
  }

  private getFileTypeModule(): Promise<typeof import("file-type")> {
    this.fileTypeModulePromise ??= loadEsm<typeof import("file-type")>("file-type");

    return this.fileTypeModulePromise;
  }

  private normalizeFileName(originalName: string): string {
    const normalized = originalName.normalize("NFKC").replace(/\0/g, "").replace(/\\/g, "/");

    const fileName = basename(normalized).trim();

    if (!fileName) {
      throw new BadRequestException("File name is required.");
    }

    return fileName;
  }

  private extractExtension(fileName: string): string | null {
    const extension = extname(fileName).slice(1).trim().toLowerCase();

    return extension || null;
  }

  private normalizeMimeType(mimeType?: string): string | null {
    const normalized = mimeType?.split(";")[0]?.trim().toLowerCase();

    return normalized || null;
  }
}
