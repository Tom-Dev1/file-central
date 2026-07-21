import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DriveItem, DriveItemSchema } from '../drive-items/schemas/drive-item.schema';
import { Share, ShareSchema } from '../shares/schemas/share.schema';
import { PermissionsService } from './permissions.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DriveItem.name, schema: DriveItemSchema },
      { name: Share.name, schema: ShareSchema },
    ]),
  ],
  providers: [PermissionsService],
  exports: [PermissionsService, MongooseModule],
})
export class PermissionsModule {}
