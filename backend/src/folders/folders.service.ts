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
    // Auto-rename on collision: "New Folder" -> "New Folder 1", etc.
    const uniqueName = await this.driveItemsService.resolveUniqueName(ownerId, parentId, dto.name);

    const folder = await this.driveItemsService.model.create({
      name: uniqueName,
      type: DriveItemType.FOLDER,
      ownerId: new Types.ObjectId(ownerId),
      parentId,
      isDeleted: false,
      // A freshly created folder is both "just modified" and "just viewed".
      lastModifiedAt: new Date(),
      lastViewedAt: new Date(),
    });

    return folder;
  }
}
