import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { DriveItemsService } from '../drive-items/drive-items.service';
import { DriveItemType } from '../drive-items/schemas/drive-item.schema';
import { CreateFolderDto } from './dto/create-folder.dto';

@Injectable()
export class FoldersService {
  constructor(private driveItemsService: DriveItemsService) {}

  async create(ownerId: string, dto: CreateFolderDto) {
    const parentId = await this.driveItemsService.assertValidParent(ownerId, dto.parentId);
    await this.driveItemsService.assertNoDuplicateName(ownerId, parentId, dto.name);

    const folder = await this.driveItemsService.model.create({
      name: dto.name,
      type: DriveItemType.FOLDER,
      ownerId: new Types.ObjectId(ownerId),
      parentId,
      isDeleted: false,
    });

    return folder;
  }
}
