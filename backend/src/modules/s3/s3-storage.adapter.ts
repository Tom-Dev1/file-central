import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3_CONFIG_TOKEN, S3ConfigShape } from "../../configs";
import { Readable } from "node:stream";

export interface RemotePart {
  partNumber: number;
  etag: string;
  sizeBytes: number;
}

export interface PresignedGetOptions {
  expiresIn?: number;
  responseContentType?: string;
  responseContentDisposition?: string; // 'inline' | 'attachment; filename="..."'
}

@Injectable()
export class S3StorageAdapter {
  private readonly logger = new Logger(S3StorageAdapter.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly defaultPresignExpiry = 3600;

  constructor(private readonly configService: ConfigService) {
    const config = this.configService.getOrThrow<S3ConfigShape>(S3_CONFIG_TOKEN);
    this.bucket = config.bucket;
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
    });
  }

  getBucketName(): string {
    return this.bucket;
  }

  async assertAvailable(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }

  buildObjectKey(ownerId: string, uploadSessionId: string): string {
    return `objects/${ownerId}/${uploadSessionId}`;
  }

  //
  // MULTIPART UPLOAD
  //

  async createMultipartUpload(objectKey: string, contentType?: string): Promise<string> {
    const res = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: objectKey,
        ContentType: contentType,
      })
    );
    if (!res.UploadId) {
      throw new Error("Provider did not return an UploadId");
    }
    return res.UploadId;
  }

  // Presigned URL Ä‘á»ƒ client PUT 1 part to MinIO.
  async getPresignedPartUrl(
    objectKey: string,
    providerUploadId: string,
    partNumber: number,
    expiresIn = this.defaultPresignExpiry
  ): Promise<string> {
    const command = new UploadPartCommand({
      Bucket: this.bucket,
      Key: objectKey,
      UploadId: providerUploadId,
      PartNumber: partNumber,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  // Presigned URL client PUT file (single-part upload).
  async getPresignedPutUrl(
    objectKey: string,
    contentType?: string,
    expiresIn = this.defaultPresignExpiry
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  async putObject(
    objectKey: string,
    body: Readable,
    contentLength: number,
    contentType: string,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: body,
        ContentLength: contentLength,
        ContentType: contentType,
      }),
    );
  }

  //** list parts upload. Auto pagination => ListParts return max 1000 part/1 time.
  async listParts(objectKey: string, providerUploadId: string): Promise<RemotePart[]> {
    const parts: RemotePart[] = [];
    let partNumberMarker: string | undefined;
    do {
      const res = await this.client.send(
        new ListPartsCommand({
          Bucket: this.bucket,
          Key: objectKey,
          UploadId: providerUploadId,
          PartNumberMarker: partNumberMarker,
        })
      );
      for (const p of res.Parts ?? []) {
        if (p.PartNumber && p.ETag && p.Size !== undefined) {
          parts.push({
            partNumber: p.PartNumber,
            etag: p.ETag,
            sizeBytes: p.Size,
          });
        }
      }
      partNumberMarker = res.IsTruncated ? res.NextPartNumberMarker : undefined;
    } while (partNumberMarker);
    return parts;
  }

  async completeMultipartUpload(
    objectKey: string,
    providerUploadId: string,
    parts: { partNumber: number; etag: string }[]
  ): Promise<{ etag: string }> {
    const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber);
    const res = await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: objectKey,
        UploadId: providerUploadId,
        MultipartUpload: {
          Parts: sorted.map((p) => ({
            PartNumber: p.partNumber,
            ETag: p.etag,
          })),
        },
      })
    );
    return { etag: res.ETag ?? "" };
  }

  async abortMultipartUpload(objectKey: string, providerUploadId: string): Promise<void> {
    try {
      await this.client.send(
        new AbortMultipartUploadCommand({
          Bucket: this.bucket,
          Key: objectKey,
          UploadId: providerUploadId,
        })
      );
    } catch (error) {
      const providerError = error as {
        name?: string;
        Code?: string;
        $metadata?: { httpStatusCode?: number };
      };
      if (
        providerError.name === "NoSuchUpload" ||
        providerError.Code === "NoSuchUpload" ||
        providerError.$metadata?.httpStatusCode === 404
      ) {
        return;
      }
      this.logger.error(`Abort multipart failed for key ${objectKey}`);
      throw error;
    }
  }

  //
  // GET / DOWNLOAD
  //

  // Presigned URL for client GET (preview/download) object => MinIO.

  async getPresignedGetUrl(objectKey: string, options: PresignedGetOptions = {}): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ResponseContentType: options.responseContentType,
      ResponseContentDisposition: options.responseContentDisposition,
    });
    return getSignedUrl(this.client, command, {
      expiresIn: options.expiresIn ?? this.defaultPresignExpiry,
    });
  }

  async getObject(objectKey: string): Promise<{
    stream: Readable;
    contentLength?: number;
    contentType?: string;
  }> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }),
    );
    return {
      stream: result.Body as Readable,
      contentLength: result.ContentLength,
      contentType: result.ContentType,
    };
  }

  // read a part byte of object server Buffer
  // @param start (byte start)
  // @param end (byte end)

  async getObjectRange(objectKey: string, start: number, end: number): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Range: `bytes=${start}-${end}`,
      })
    );
    return this.streamToBuffer(res.Body);
  }

  // stream body (Node.js Readable) to Buffer.
  private async streamToBuffer(body: unknown): Promise<Buffer> {
    if (!body) return Buffer.alloc(0);
    // AWS SDK v3 in Node return Readable stream.
    const stream = body as AsyncIterable<Uint8Array>;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  //
  // HEAD / DELETE
  //

  //Get metadata object (size, content-type). null if dont exists.

  async headObject(objectKey: string): Promise<{ sizeBytes: number; contentType?: string } | null> {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }));
      return {
        sizeBytes: res.ContentLength ?? 0,
        contentType: res.ContentType,
      };
    } catch {
      return null;
    }
  }

  // Delete object.
  async deleteObject(objectKey: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }));
  }
}
