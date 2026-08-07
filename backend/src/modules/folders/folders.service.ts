import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { CreateFolderCommand } from '../drive-items/application/commands/folders/create-folder.command';
import { DriveItemParentService } from '../drive-items/application/services/drive-item-parent.service';
import { CreateFolderDto } from './dto/create-folder.dto';

@Injectable()
export class FoldersService {
  constructor(
    private readonly parents: DriveItemParentService,
    private readonly createFolder: CreateFolderCommand,
  ) {}

  async create(ownerIdValue: string, dto: CreateFolderDto) {
    const parentId = await this.parents.validate(ownerIdValue, dto.parentId);
    return this.createFolder.execute({ ownerId: new Types.ObjectId(ownerIdValue), parentId, name: dto.name });
  }
}
