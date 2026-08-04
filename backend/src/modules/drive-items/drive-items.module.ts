import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DriveItem, DriveItemSchema } from './schemas/drive-item.schema';
import { DriveItemsService } from './drive-items.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: DriveItem.name, schema: DriveItemSchema }])],
  providers: [DriveItemsService],
  exports: [DriveItemsService, MongooseModule],
})
export class DriveItemsModule {}
