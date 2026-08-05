import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DriveItem, DriveItemSchema } from './schemas/drive-item.schema';
import { DriveItemsService } from './drive-items.service';
import { ChildCountReconcileCron } from './child-count-reconcile.cron';

@Module({
  imports: [MongooseModule.forFeature([{ name: DriveItem.name, schema: DriveItemSchema }])],
  providers: [DriveItemsService, ChildCountReconcileCron],
  exports: [DriveItemsService, MongooseModule],
})
export class DriveItemsModule {}
