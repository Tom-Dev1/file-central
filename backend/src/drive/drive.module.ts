import { Module } from '@nestjs/common';
import { DriveItemsModule } from '../drive-items/drive-items.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { DriveService } from './drive.service';
import { DriveController } from './drive.controller';

@Module({
  imports: [DriveItemsModule, PermissionsModule],
  controllers: [DriveController],
  providers: [DriveService],
})
export class DriveModule {}
