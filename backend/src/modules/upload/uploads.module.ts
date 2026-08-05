import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { UploadsReaperCron } from './uploads-reaper.cron';
import { S3StorageAdapter } from './storage/s3-storage.adapter';
import { UploadSession, UploadSessionSchema } from './schemas/upload-session.schema';
import { UploadPart, UploadPartSchema } from './schemas/upload-part.schema';
import { DriveItemsModule } from '../drive-items/drive-items.module';
import { StorageModule } from '../storage/storage.module';
import { QuotaModule } from '../quota/quota.module';
import { FileMetadataResolverService } from '../files/file-metadata-resolver.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: UploadSession.name, schema: UploadSessionSchema },
            { name: UploadPart.name, schema: UploadPartSchema },
        ]),
        DriveItemsModule,
        StorageModule,
        QuotaModule,
        // DriveItemsModule, QuotaModule, StorageObjectsModule — import thật ở đây
    ],
    controllers: [UploadsController],
    providers: [UploadsService, UploadsReaperCron, S3StorageAdapter, FileMetadataResolverService],
    exports: [UploadsService],
})
export class UploadsModule { }
