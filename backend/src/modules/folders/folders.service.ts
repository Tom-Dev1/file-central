import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { DriveItemsService } from '../drive-items/drive-items.service';
import { CreateFolderDto } from './dto/create-folder.dto';

@Injectable()
export class FoldersService {
  constructor(private readonly driveItems: DriveItemsService) {}

  async create(ownerIdValue: string, dto: CreateFolderDto) {
    const parentId = await this.driveItems.assertValidParent(ownerIdValue, dto.parentId);
    return this.driveItems.createFolder({ ownerId: new Types.ObjectId(ownerIdValue), parentId, name: dto.name });
  }
}
