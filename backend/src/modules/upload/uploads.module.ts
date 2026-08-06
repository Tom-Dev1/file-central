import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { UploadsController } from "./uploads.controller";
import { UploadsService } from "./uploads.service";

import { UploadSession, UploadSessionSchema } from "./schemas/upload-session.schema";
import { UploadPart, UploadPartSchema } from "./schemas/upload-part.schema";

import { StorageModule } from "../storage/storage.module";
import { DriveItemsModule } from "../drive-items/drive-items.module";
import { QuotaModule } from "../quota/quota.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UploadSession.name, schema: UploadSessionSchema },
      { name: UploadPart.name, schema: UploadPartSchema },
    ]),
    StorageModule,
    DriveItemsModule,
    QuotaModule,
    AuthModule,
  ],
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
