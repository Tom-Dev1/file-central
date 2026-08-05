import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { DriveItemsService } from '../drive-items/drive-items.service';
import { PermissionsService } from '../permissions/permissions.service';
import { SharePermission } from '../shares/schemas/share.schema';
import { MoveDto } from './dto/move.dto';
import { RenameDto } from './dto/rename.dto';

@Injectable()
export class DriveService {
  constructor(private readonly driveItems: DriveItemsService, private readonly permissions: PermissionsService) {}

  async list(userId: string, parentId: string | null, cursor: string | undefined, limit: number) {
    const filter: Record<string, unknown> = { ownerId: new Types.ObjectId(userId), parentId: parentId ? new Types.ObjectId(parentId) : null, isTrashed: false };
    if (cursor) {
      const value = this.decodeCursor<{ type: string; normalizedName: string; id: string }>(cursor);
      filter.$or = [
        { type: { $lt: value.type } },
        { type: value.type, normalizedName: { $gt: value.normalizedName } },
        { type: value.type, normalizedName: value.normalizedName, _id: { $gt: new Types.ObjectId(value.id) } },
      ];
    }
    const rows = await this.driveItems.model.find(filter).select('+normalizedName').sort({ type: -1, normalizedName: 1, _id: 1 }).limit(limit + 1).lean();
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return { items, limit, nextCursor: hasMore && last ? this.encodeCursor({ type: last.type, normalizedName: last.normalizedName, id: last._id.toString() }) : null };
  }

  async search(userId: string, query: string, type: 'file' | 'folder' | undefined, cursor: string | undefined, limit: number) {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter: Record<string, unknown> = { ownerId: new Types.ObjectId(userId), isTrashed: false, normalizedName: { $regex: escaped, $options: 'i' } };
    if (type) filter.type = type;
    if (cursor) {
      const value = this.decodeCursor<{ lastModifiedAt: string; id: string }>(cursor);
      const date = new Date(value.lastModifiedAt);
      if (Number.isNaN(date.getTime())) throw new BadRequestException('INVALID_CURSOR');
      filter.$or = [{ lastModifiedAt: { $lt: date } }, { lastModifiedAt: date, _id: { $lt: new Types.ObjectId(value.id) } }];
    }
    const rows = await this.driveItems.model.find(filter).sort({ lastModifiedAt: -1, _id: -1 }).limit(limit + 1).lean();
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return { items, limit, nextCursor: hasMore && last ? this.encodeCursor({ lastModifiedAt: last.lastModifiedAt.toISOString(), id: last._id.toString() }) : null };
  }

  async getById(userId: string, userEmail: string | undefined, itemIdValue: string) {
    const itemId = new Types.ObjectId(itemIdValue);
    await this.permissions.requireAccess(userId, userEmail, itemId, SharePermission.VIEW);
    const item = await this.driveItems.model.findOne({ _id: itemId, isTrashed: false });
    if (!item) throw new NotFoundException('DRIVE_ITEM_NOT_FOUND');
    return item;
  }

  async getAncestors(userId: string, userEmail: string | undefined, itemIdValue: string) {
    const itemId = new Types.ObjectId(itemIdValue);
    const access = await this.permissions.requireAccess(userId, userEmail, itemId, SharePermission.VIEW);
    const chain = await this.driveItems.getAncestorsIncludingSelf(itemId);
    if (access.isOwner) return chain;
    const entry = await this.permissions.findShareEntryPoint(userId, userEmail, chain.map((item) => item._id));
    const index = entry ? chain.findIndex((item) => item._id.equals(entry)) : 0;
    return chain.slice(Math.max(index, 0));
  }

  async rename(userId: string, userEmail: string | undefined, itemIdValue: string, dto: RenameDto) {
    const itemId = new Types.ObjectId(itemIdValue);
    await this.permissions.requireAccess(userId, userEmail, itemId, SharePermission.EDIT);
    const item = await this.driveItems.model.findById(itemId).select('ownerId').lean();
    if (!item) throw new NotFoundException('DRIVE_ITEM_NOT_FOUND');
    return this.driveItems.rename({ ownerId: item.ownerId, itemId, name: dto.name, expectedMetadataVersion: dto.expectedMetadataVersion });
  }

  async move(userId: string, userEmail: string | undefined, itemIdValue: string, dto: MoveDto) {
    const itemId = new Types.ObjectId(itemIdValue);
    await this.permissions.requireAccess(userId, userEmail, itemId, SharePermission.EDIT);
    const item = await this.driveItems.model.findById(itemId).select('ownerId').lean();
    if (!item) throw new NotFoundException('DRIVE_ITEM_NOT_FOUND');
    return this.driveItems.move({ ownerId: item.ownerId, itemId, newParentId: dto.newParentId ? new Types.ObjectId(dto.newParentId) : null, expectedMetadataVersion: dto.expectedMetadataVersion });
  }

  async remove(userId: string, userEmail: string | undefined, itemIdValue: string) {
    const itemId = new Types.ObjectId(itemIdValue);
    await this.permissions.requireAccess(userId, userEmail, itemId, SharePermission.EDIT);
    const deletedIds = await this.driveItems.softDeleteRecursive(itemId);
    if (!deletedIds.length) throw new NotFoundException('DRIVE_ITEM_NOT_FOUND');
    return { deletedIds: deletedIds.map((id) => id.toString()) };
  }

  private encodeCursor(value: unknown): string { return Buffer.from(JSON.stringify(value)).toString('base64url'); }

  private decodeCursor<T>(cursor: string): T {
    try { return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as T; }
    catch { throw new BadRequestException('INVALID_CURSOR'); }
  }
}
