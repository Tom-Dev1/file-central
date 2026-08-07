import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { StorageObjectsService } from "./storage-objects.services";

@Injectable()
export class StorageCleanupWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StorageCleanupWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly storageObjects: StorageObjectsService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), 5 * 60 * 1000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      let count: number;
      do {
        count = await this.storageObjects.retryFailedDeletions(100);
      } while (count === 100);
    } catch (error) {
      this.logger.error(
        "Storage cleanup failed",
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }
}
