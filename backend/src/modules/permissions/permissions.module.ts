import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { DriveItemsModule } from "../drive-items/drive-items.module";
import { Share, ShareSchema } from "../shares/schemas/share.schema";
import { PermissionsService } from "./permissions.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Share.name, schema: ShareSchema },
    ]),
    DriveItemsModule,
  ],
  providers: [PermissionsService],
  exports: [PermissionsService, MongooseModule],
})
export class PermissionsModule {}
