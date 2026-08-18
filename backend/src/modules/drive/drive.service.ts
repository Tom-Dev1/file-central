import { Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { MoveDriveItemCommand } from '../drive-items/application/commands/items/move-drive-item.command';
import { MoveDriveItemsCommand } from '../drive-items/application/commands/items/move-drive-items.command';
import { RenameDriveItemCommand } from '../drive-items/application/commands/items/rename-drive-item.command';
import { TrashDriveItemCommand } from '../drive-items/application/commands/trash/trash-drive-item.command';
import { TrashDriveItemsCommand } from '../drive-items/application/commands/trash/trash-drive-items.command';
import { GetDriveItemAncestorsQuery } from '../drive-items/application/queries/get-drive-item-ancestors.query';
import { DriveItemLookupQuery } from '../drive-items/application/queries/drive-item-lookup.query';
import { ListDriveItemsQuery } from '../drive-items/application/queries/list-drive-items.query';
import { SearchDriveItemsQuery } from '../drive-items/application/queries/search-drive-items.query';
import { PermissionsService } from '../permissions/permissions.service';
import { SharePermission } from '../shares/schemas/share.schema';
import { MoveDto } from './dto/move.dto';
import { RenameDto } from './dto/rename.dto';
import { DriveItemSortBy, DriveItemSortDirection } from '../drive-items/domain/enums/drive-item.enum';
import { BulkMoveDto } from './dto/bulk-move.dto';

@Injectable()
export class DriveService {
  constructor(
    private readonly items: DriveItemLookupQuery,
    private readonly listItems: ListDriveItemsQuery,
    private readonly searchItems: SearchDriveItemsQuery,
    private readonly ancestorsQuery: GetDriveItemAncestorsQuery,
    private readonly renameCommand: RenameDriveItemCommand,
    private readonly moveCommand: MoveDriveItemCommand,
    private readonly moveItemsCommand: MoveDriveItemsCommand,
    private readonly trashCommand: TrashDriveItemCommand,
    private readonly trashItemsCommand: TrashDriveItemsCommand,
    private readonly permissions: PermissionsService,
  ) {}

  async list(
    userId: string,
    parentId: string | null,
    cursor: string | undefined,
    limit: number,
    sort: DriveItemSortBy,
    direction: DriveItemSortDirection,
  ) {
    return this.listItems.execute({ ownerId: userId, parentId, cursor, limit, sort, direction });
  }

  async search(userId: string, query: string, type: 'file' | 'folder' | undefined, cursor: string | undefined, limit: number) {
    return this.searchItems.execute({ ownerId: userId, query, type, cursor, limit });
  }

  async getById(userId: string, userEmail: string | undefined, itemIdValue: string) {
    const itemId = new Types.ObjectId(itemIdValue);
    await this.permissions.requireAccess(userId, userEmail, itemId, SharePermission.VIEW);
    const item = await this.items.findOne({ _id: itemId, isTrashed: false });
    if (!item) throw new NotFoundException('DRIVE_ITEM_NOT_FOUND');
    return item;
  }

  async getAncestors(userId: string, userEmail: string | undefined, itemIdValue: string) {
    const itemId = new Types.ObjectId(itemIdValue);
    const access = await this.permissions.requireAccess(userId, userEmail, itemId, SharePermission.VIEW);
    const chain = await this.ancestorsQuery.execute(itemId);
    if (access.isOwner) return chain;
    const entry = await this.permissions.findShareEntryPoint(userId, userEmail, chain.map((item) => item._id));
    const index = entry ? chain.findIndex((item) => item._id.equals(entry)) : 0;
    return chain.slice(Math.max(index, 0));
  }

  async rename(userId: string, userEmail: string | undefined, itemIdValue: string, dto: RenameDto) {
    const itemId = new Types.ObjectId(itemIdValue);
    await this.permissions.requireAccess(userId, userEmail, itemId, SharePermission.EDIT);
    const item = await this.items.findById(itemId, 'ownerId');
    if (!item) throw new NotFoundException('DRIVE_ITEM_NOT_FOUND');
    return this.renameCommand.execute({ ownerId: item.ownerId, itemId, name: dto.name, expectedMetadataVersion: dto.expectedMetadataVersion });
  }

  async move(userId: string, userEmail: string | undefined, itemIdValue: string, dto: MoveDto) {
    const itemId = new Types.ObjectId(itemIdValue);
    await this.permissions.requireAccess(userId, userEmail, itemId, SharePermission.EDIT);
    const item = await this.items.findById(itemId, 'ownerId');
    if (!item) throw new NotFoundException('DRIVE_ITEM_NOT_FOUND');
    return this.moveCommand.execute({ ownerId: item.ownerId, itemId, newParentId: dto.newParentId ? new Types.ObjectId(dto.newParentId) : null, expectedMetadataVersion: dto.expectedMetadataVersion });
  }

  async moveMany(userId: string, userEmail: string | undefined, dto: BulkMoveDto) {
    const items = dto.items.map((item) => ({
      itemId: new Types.ObjectId(item.id),
      expectedMetadataVersion: item.expectedMetadataVersion,
    }));

    await Promise.all(
      items.map((item) =>
        this.permissions.requireAccess(userId, userEmail, item.itemId, SharePermission.EDIT),
      ),
    );

    const movedIds = await this.moveItemsCommand.execute({
      items,
      newParentId: dto.newParentId ? new Types.ObjectId(dto.newParentId) : null,
    });
    return { movedIds: movedIds.map((id) => id.toString()) };
  }

  async remove(userId: string, userEmail: string | undefined, itemIdValue: string) {
    const itemId = new Types.ObjectId(itemIdValue);
    await this.permissions.requireAccess(userId, userEmail, itemId, SharePermission.EDIT);
    const deletedIds = await this.trashCommand.execute(itemId);
    if (!deletedIds.length) throw new NotFoundException('DRIVE_ITEM_NOT_FOUND');
    return { deletedIds: deletedIds.map((id) => id.toString()) };
  }

  async removeMany(userId: string, userEmail: string | undefined, itemIdValues: string[]) {
    const itemIds = Array.from(new Set(itemIdValues)).map((itemId) => new Types.ObjectId(itemId));

    await Promise.all(
      itemIds.map((itemId) =>
        this.permissions.requireAccess(userId, userEmail, itemId, SharePermission.EDIT),
      ),
    );

    const deletedIds = await this.trashItemsCommand.execute(itemIds);
    if (!deletedIds.length) throw new NotFoundException('DRIVE_ITEM_NOT_FOUND');
    return { deletedIds: deletedIds.map((id) => id.toString()) };
  }

}
