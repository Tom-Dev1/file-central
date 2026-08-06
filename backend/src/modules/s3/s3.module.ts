import { Module, OnModuleInit, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CreateBucketCommand, HeadBucketCommand, PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";
import { S3Service } from "./s3.service";
import { PresignController } from "./presign.controller";
import { S3_CONFIG_TOKEN, S3ConfigShape } from "src/configs";
import { S3StorageAdapter } from "./s3-storage.adapter";

/**
 * S3 module â€” provides S3Client + S3Service and ensures the bucket exists at startup.
 */
@Module({
  controllers: [PresignController],
  providers: [
    S3Service,
    S3StorageAdapter,
    {
      provide: S3Client,
      inject: [ConfigService],
      useFactory: (cs: ConfigService): S3Client => {
        const cfg = cs.getOrThrow<S3ConfigShape>(S3_CONFIG_TOKEN);
        return new S3Client({
          endpoint: cfg.endpoint,
          region: cfg.region,
          credentials: {
            accessKeyId: cfg.accessKey,
            secretAccessKey: cfg.secretKey,
          },
          forcePathStyle: cfg.forcePathStyle,
        });
      },
    },
  ],
  exports: [S3Service, S3StorageAdapter],
})
export class S3Module implements OnModuleInit {
  private readonly logger = new Logger(S3Module.name);

  constructor(private readonly s3: S3Client, private readonly configService: ConfigService) {}

  /**
   * Ensure the bucket exists â€” idempotent: HEAD first, create when missing.
   */
  async onModuleInit(): Promise<void> {
    const cfg = this.configService.getOrThrow<S3ConfigShape>(S3_CONFIG_TOKEN);
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: cfg.bucket }));
      // Bucket already exists â€” nothing to do.
      this.logger.log(`Bucket "${cfg.bucket}" already exists`);
    } catch {
      try {
        // Bucket missing â€” create it now (first boot or volume wipe).
        await this.s3.send(new CreateBucketCommand({ Bucket: cfg.bucket }));
        this.logger.log(`Bucket "${cfg.bucket}" created`);
      } catch (err) {
        this.logger.error(`Failed to ensure bucket "${cfg.bucket}": ${(err as Error).message}`);
      }
    }
    try {
      await this.s3.send(
        new PutBucketCorsCommand({
          Bucket: cfg.bucket,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedOrigins: (process.env.UPLOAD_CORS_ORIGINS ?? "http://localhost:3030,http://localhost:5173")
                  .split(",")
                  .map((origin) => origin.trim())
                  .filter(Boolean),
                AllowedMethods: ["GET", "PUT", "HEAD"],
                AllowedHeaders: ["*"],
                ExposeHeaders: ["ETag"],
                MaxAgeSeconds: 3600,
              },
            ],
          },
        })
      );
      this.logger.log(`CORS configured for bucket "${cfg.bucket}"`);
    } catch (err) {
      this.logger.error(`Failed to configure CORS for bucket "${cfg.bucket}": ${(err as Error).message}`);
    }
  }
}
