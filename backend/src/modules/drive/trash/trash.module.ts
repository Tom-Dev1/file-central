import { Module } from "@nestjs/common";
import { DriveItemsModule } from "../../drive-items/drive-items.module";
import { StorageModule } from "../../storage/storage.module";
import { TrashService } from "./trash.service";
import { TrashController } from "./trash.controller";

import { QuotaModule } from '../../quota/quota.module';
import { SharesModule } from '../../shares/shares.module';

@Module({
  imports: [DriveItemsModule, StorageModule, QuotaModule, SharesModule],
  controllers: [TrashController],
  providers: [TrashService],
})
export class TrashModule {}
