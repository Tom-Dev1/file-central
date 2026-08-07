import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";

import { HealthController } from "./health.controller";
import { StorageModule } from "../../modules/storage/storage.module";
import { StorageHealthIndicator } from "./storage-health.indicator";

@Module({
  imports: [TerminusModule, StorageModule],
  controllers: [HealthController],
  providers: [StorageHealthIndicator],
})
export class HealthModule {}
