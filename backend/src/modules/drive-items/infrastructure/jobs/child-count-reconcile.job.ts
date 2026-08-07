import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { DriveItemChildCountService } from "../../application/services/drive-item-child-count.service";

@Injectable()
export class ChildCountReconcileJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChildCountReconcileJob.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly childCounts: DriveItemChildCountService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), 15 * 60 * 1000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.childCounts.reconcile();
    } catch (error) {
      this.logger.error(
        "Child-count reconciliation failed",
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }
}
