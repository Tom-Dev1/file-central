import { Module } from "@nestjs/common";
import { DriveItemsModule } from "../../drive-items/drive-items.module";
import { StorageModule } from "../../storage/storage.module";
import { TrashService } from "./trash.service";
import { TrashController } from "./trash.controller";

@Module({
  imports: [DriveItemsModule, StorageModule],
  controllers: [TrashController],
  providers: [TrashService],
})
export class TrashModule {}
