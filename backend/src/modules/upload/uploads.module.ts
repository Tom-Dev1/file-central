import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { UploadsController } from "./uploads.controller";

import { UploadSession, UploadSessionSchema } from "./schemas/upload-session.schema";
import { UploadPart, UploadPartSchema } from "./schemas/upload-part.schema";

import { StorageModule } from "../storage/storage.module";
import { DriveItemsModule } from "../drive-items/drive-items.module";
import { QuotaModule } from "../quota/quota.module";
import { AuthModule } from "../auth/auth.module";
import { UploadsReaperCron } from "./uploads-reaper.cron";
import { CompleteUploadUseCase } from "./application/complete-upload.use-case";
import { GetUploadStatusUseCase } from "./application/get-upload-status.use-case";
import { InitUploadUseCase } from "./application/init-upload.use-case";
import { PauseUploadUseCase } from "./application/pause-upload.use-case";
import { ReapExpiredUploadsUseCase } from "./application/reap-expired-uploads.use-case";
import { AbortUploadUseCase } from "./application/abort-upload.use-case";

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
  providers: [
    UploadsReaperCron,
    InitUploadUseCase,
    GetUploadStatusUseCase,
    CompleteUploadUseCase,
    PauseUploadUseCase,
    AbortUploadUseCase,
    ReapExpiredUploadsUseCase,
  ],
})
export class UploadsModule {}
