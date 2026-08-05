import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Share, ShareSchema } from "./schemas/share.schema";
import { SharesService } from "./shares.service";
import { SharesController } from "./shares.controller";
import { DriveItemsModule } from "../drive-items/drive-items.module";
import { PermissionsModule } from "../permissions/permissions.module";
import { UsersModule } from "../users/users.module";
import { StorageModule } from "../storage/storage.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Share.name, schema: ShareSchema }]),
    DriveItemsModule,
    PermissionsModule,
    UsersModule,
    StorageModule,
  ],
  controllers: [SharesController],
  providers: [SharesService],
  exports: [SharesService],
})
export class SharesModule {}
