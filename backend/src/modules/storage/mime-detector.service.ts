import { Injectable } from "@nestjs/common";
import * as mimeTypes from "mime-types";

@Injectable()
export class MimeDetectorService {
  async detect(head: Buffer, fileName: string): Promise<{ mimeType: string; extension: string | null }> {
    const { fileTypeFromBuffer } = await import("file-type");
    const ft = await fileTypeFromBuffer(head);

    const extFromName = this.extFromName(fileName);

    if (ft) {
      return { mimeType: ft.mime, extension: ft.ext };
    }

    const mimeFromExt = extFromName ? mimeTypes.lookup(extFromName) : false;
    return {
      mimeType: mimeFromExt || "application/octet-stream",
      extension: extFromName,
    };
  }

  private extFromName(name: string): string | null {
    const idx = name.lastIndexOf(".");
    return idx > 0 ? name.slice(idx + 1).toLowerCase() : null;
  }
}
