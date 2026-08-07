import { Injectable } from "@nestjs/common";
import { HealthIndicatorService } from "@nestjs/terminus";
import { S3StorageAdapter } from "../../modules/s3/s3-storage.adapter";

@Injectable()
export class StorageHealthIndicator {
  constructor(
    private readonly storage: S3StorageAdapter,
    private readonly healthIndicator: HealthIndicatorService,
  ) {}

  async check() {
    const indicator = this.healthIndicator.check("storage");
    try {
      await this.storage.assertAvailable();
      return indicator.up({ bucket: this.storage.getBucketName() });
    } catch (error) {
      return indicator.down({
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
