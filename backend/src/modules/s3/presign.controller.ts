import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { S3Service, type PresignedUploadInfo } from "./s3.service";
import { PresignPutDto } from "./dto/presign-put.dto";
import { ApiTags } from "@nestjs/swagger";

/**
 * PresignController — HTTP endpoints to mint short-lived presigned PUT/GET URLs.
 */
@ApiTags("presign")
@Controller("presign")
export class PresignController {
  constructor(private readonly s3Service: S3Service) {}

  /**
   * Sign a short-lived PUT URL so the client uploads directly to MinIO/S3.
   */
  @Post("put")
  async createPutUrl(@Body() dto: PresignPutDto): Promise<PresignedUploadInfo & { filename: string }> {
    const info = await this.s3Service.createUploadUrl(dto.contentType);
    // Return filename from request body alongside the signed upload info.
    return { ...info, filename: dto.filename };
  }

  /**
   * Sign a short-lived GET URL for download — bucket stays private.
   */
  @Get("get/:key")
  async createGetUrl(@Param("key") key: string): Promise<{ url: string; key: string; expiresInSeconds: number }> {
    const decoded = decodeURIComponent(key);
    const url = await this.s3Service.createDownloadUrl(decoded);
    return { url, key: decoded, expiresInSeconds: 300 };
  }
}
