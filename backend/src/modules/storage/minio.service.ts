import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { Readable } from 'stream';
import { S3_CONFIG_TOKEN, S3ConfigShape } from '../../configs';

/**
 * Thin wrapper around the MinIO S3-compatible client.
 *
 * IMPORTANT: This service knows NOTHING about folders, owners, or shares.
 * It only deals with (bucket, objectKey, binary). All business logic
 * (who owns the file, which folder it's in, who can access it) lives
 * in MongoDB via DriveItem / Share and is enforced in the service layer
 * BEFORE this class is ever called.
 */
@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private client: Client;
  private bucket: string;

  constructor(private configService: ConfigService) {
    const config = this.configService.getOrThrow<S3ConfigShape>(S3_CONFIG_TOKEN);
    const endpoint = new URL(config.endpoint);
    this.bucket = config.bucket;
    this.client = new Client({
      endPoint: endpoint.hostname,
      port: endpoint.port
        ? Number.parseInt(endpoint.port, 10)
        : endpoint.protocol === 'https:'
          ? 443
          : 80,
      useSSL: endpoint.protocol === 'https:',
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    });
  }

  async onModuleInit() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Created MinIO bucket "${this.bucket}"`);
      }
    } catch (err) {
      // Don't crash app boot if MinIO isn't reachable yet in dev; log loudly instead.
      this.logger.error(
        `Could not verify/create MinIO bucket "${this.bucket}". Is MinIO running? ${
          (err as Error).message
        }`,
      );
    }
  }

  getBucketName(): string {
    return this.bucket;
  }

  /**
   * Upload a binary buffer/stream to MinIO. Returns the objectKey that
   * the caller (FilesService) must then persist as DriveItem.objectKey.
   */
  async putObject(
    objectKey: string,
    data: Buffer | Readable,
    size: number,
    contentType?: string,
  ): Promise<void> {
    await this.client.putObject(this.bucket, objectKey, data, size, {
      'Content-Type': contentType || 'application/octet-stream',
    });
  }

  /**
   * Returns a readable stream for the object so it can be piped straight
   * to the HTTP response without buffering the whole file in memory.
   */
  async getObjectStream(objectKey: string): Promise<Readable> {
    return this.client.getObject(this.bucket, objectKey);
  }

  async statObject(objectKey: string) {
    return this.client.statObject(this.bucket, objectKey);
  }

  async removeObject(objectKey: string): Promise<void> {
    await this.client.removeObject(this.bucket, objectKey);
  }

  async removeObjects(objectKeys: string[]): Promise<void> {
    if (objectKeys.length === 0) return;
    await this.client.removeObjects(this.bucket, objectKeys);
  }
}
