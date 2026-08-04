import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { S3_CONFIG_TOKEN, S3ConfigShape } from "src/configs";

export interface PresignedUploadInfo {
  key: string;
  url: string;
  method: "PUT";
  expiresInSeconds: number;
}

/**
 * S3Service — wraps AWS SDK v3 + s3-request-presigner to sign short-lived PUT/GET URLs.
 */
@Injectable()
export class S3Service {
  private readonly cfg: S3ConfigShape;

  constructor(private readonly s3: S3Client, configService: ConfigService) {
    this.cfg = configService.getOrThrow<S3ConfigShape>(S3_CONFIG_TOKEN);
  }

  //Sign a PUT URL so the client uploads directly — bypassing the backend.

  async createUploadUrl(contentType: string): Promise<PresignedUploadInfo> {
    const key = `${Date.now()}-${randomUUID()}`;
    const command = new PutObjectCommand({
      Bucket: this.cfg.bucket,
      Key: key,
      ContentType: contentType,
    });
    // getSignedUrl embeds HMAC-SHA256 signature + expiry into URL query string.
    const url = await getSignedUrl(this.s3, command, {
      expiresIn: this.cfg.presignExpiresSeconds,
    });
    return { key, url, method: "PUT", expiresInSeconds: this.cfg.presignExpiresSeconds };
  }

  /**
   * Sign a short-lived GET URL — the bucket stays private but allows temporary downloads.
   */
  async createDownloadUrl(key: string): Promise<string> {
    // GET object command — presigner signs it with the same credentials.
    const command = new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key });
    return getSignedUrl(this.s3, command, {
      expiresIn: this.cfg.presignExpiresSeconds,
    });
  }
}
