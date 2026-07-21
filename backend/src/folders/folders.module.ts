import { Module } from '@nestjs/common';
import { DriveItemsModule } from '../drive-items/drive-items.module';
import { FoldersService } from './folders.service';
import { FoldersController } from './folders.controller';

@Module({
  imports: [DriveItemsModule],
  controllers: [FoldersController],
  providers: [FoldersService],
})
export class FoldersModule {}
