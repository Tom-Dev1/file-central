import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";

import { UploadsService } from "./uploads.service";

@Injectable()
export class UploadsReaperCron implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UploadsReaperCron.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly uploadsService: UploadsService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.handleTick(), 5 * 60 * 1000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async handleTick() {
    if (this.running) return;
    this.running = true;
    try {
      let total = 0;
      let count: number;
      do {
        count = await this.uploadsService.reapExpiredSessions(100);
        total += count;
      } while (count > 0);
      if (total > 0) this.logger.log(`Reaped ${total} expired upload sessions`);
    } catch (error) {
      this.logger.error("Upload reaper failed", error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }
}
