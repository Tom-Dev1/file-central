import { Module } from "@nestjs/common";
import { MinioService } from "./minio.service";
import { StorageObjectsService } from "./storage-objects.services";
import { MimeDetectorService } from "./mime-detector.service";
import { MongooseModule } from "@nestjs/mongoose";
import { StorageObjectDoc, StorageObjectSchema } from "./schemas/storage-object.schema";
import { S3StorageAdapter } from "../s3/s3-storage.adapter";
import { StorageCleanupWorker } from "./storage-cleanup.worker";

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: StorageObjectDoc.name,
        schema: StorageObjectSchema,
      },
    ]),
  ],
  providers: [
    MinioService,
    StorageObjectsService,
    MimeDetectorService,
    S3StorageAdapter,
    StorageCleanupWorker,
  ],
  exports: [MinioService, StorageObjectsService, MimeDetectorService, S3StorageAdapter],
})
export class StorageModule {}
