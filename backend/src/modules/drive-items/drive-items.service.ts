import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DriveItem, DriveItemDocument, DriveItemType, MAX_FOLDER_DEPTH } from './schemas/drive-item.schema';
import { FileStatus } from './enums/drive-item.enum';

const MAX_SYNC_SUBTREE_ITEMS = 1000;

@Injectable()
export class DriveItemsService {
  constructor(@InjectModel(DriveItem.name) private readonly driveItemModel: Model<DriveItemDocument>) {}

  get model() { return this.driveItemModel; }

  normalizeName(name: string): string {
    return name.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
  }

  extractExtension(name: string): string | null {
    const index = name.lastIndexOf('.');
    return index > 0 ? name.slice(index + 1).toLowerCase() : null;
  }

  async resolveAncestors(ownerId: Types.ObjectId, parentId: Types.ObjectId | null): Promise<Types.ObjectId[]> {
    if (!parentId) return [];
    const parent = await this.driveItemModel.findOne({
      _id: parentId,
      ownerId,
      type: DriveItemType.FOLDER,
      isTrashed: false,
    }).lean();
    if (!parent) throw new NotFoundException('PARENT_NOT_FOUND');
    const ancestors = [...parent.ancestorIds, parent._id];
    if (ancestors.length > MAX_FOLDER_DEPTH) throw new BadRequestException('MAX_DEPTH_EXCEEDED');
    return ancestors;
  }

  async createFolder(args: { ownerId: Types.ObjectId; parentId: Types.ObjectId | null; name: string }) {
    const ancestorIds = await this.resolveAncestors(args.ownerId, args.parentId);
    try {
      const folder = await this.driveItemModel.create({
        ...args,
        ancestorIds,
        normalizedName: this.normalizeName(args.name),
        type: DriveItemType.FOLDER,
        storageObjectId: null,
        fileStatus: null,
        mimeType: null,
        sizeBytes: null,
        extension: null,
        childCount: 0,
      });
      await this.adjustChildCount(args.parentId, 1);
      return folder;
    } catch (error) { this.rethrowDuplicate(error); }
  }

  async createPlaceholder(args: { ownerId: Types.ObjectId; parentId: Types.ObjectId | null; name: string }) {
    const ancestorIds = await this.resolveAncestors(args.ownerId, args.parentId);
    for (let copyNumber = 0; ; copyNumber++) {
      const name = this.getUploadCopyName(args.name, copyNumber);
      try {
        const item = await this.driveItemModel.create({
          ...args,
          name,
          ancestorIds,
          normalizedName: this.normalizeName(name),
          type: DriveItemType.FILE,
          storageObjectId: null,
          fileStatus: FileStatus.UPLOADING,
          mimeType: null,
          sizeBytes: null,
          extension: this.extractExtension(name),
          childCount: null,
        });
        return { id: item._id, name: item.name };
      } catch (error) {
        if (!this.isDuplicateKeyError(error)) throw error;
      }
    }
  }

  private getUploadCopyName(originalName: string, copyNumber: number): string {
    if (copyNumber === 0) return originalName;
    const extensionIndex = originalName.lastIndexOf('.');
    const stem = extensionIndex > 0 ? originalName.slice(0, extensionIndex) : originalName;
    const extension = extensionIndex > 0 ? originalName.slice(extensionIndex) : '';
    const suffix = `(${copyNumber})`;
    return `${stem.slice(0, 255 - extension.length - suffix.length)}${suffix}${extension}`;
  }

  async activateFile(args: { driveItemId: Types.ObjectId; storageObjectId: Types.ObjectId; mimeType: string; sizeBytes: bigint; extension: string | null }) {
    const item = await this.driveItemModel.findOneAndUpdate(
      { _id: args.driveItemId, type: DriveItemType.FILE, fileStatus: { $in: [FileStatus.UPLOADING, FileStatus.PROCESSING] } },
      { $set: { storageObjectId: args.storageObjectId, fileStatus: FileStatus.ACTIVE, mimeType: args.mimeType, sizeBytes: args.sizeBytes, extension: args.extension, lastModifiedAt: new Date() }, $inc: { metadataVersion: 1 } },
      { returnDocument: 'after' },
    );
    if (!item) throw new NotFoundException('DRIVE_ITEM_NOT_FOUND');
    await this.adjustChildCount(item.parentId, 1);
  }

  async rollbackActivation(driveItemId: Types.ObjectId): Promise<void> {
    const item = await this.driveItemModel.findOneAndUpdate(
      { _id: driveItemId, type: DriveItemType.FILE, fileStatus: FileStatus.ACTIVE },
      { $set: { storageObjectId: null, fileStatus: FileStatus.FAILED, mimeType: null, sizeBytes: null, extension: null }, $inc: { metadataVersion: 1 } },
      { returnDocument: 'before' },
    );
    if (item) await this.adjustChildCount(item.parentId, -1);
  }

  async markFailed(driveItemId: Types.ObjectId) {
    await this.driveItemModel.updateOne(
      { _id: driveItemId, type: DriveItemType.FILE, fileStatus: { $ne: FileStatus.ACTIVE } },
      { $set: { fileStatus: FileStatus.FAILED } },
    );
  }

  async assertValidParent(ownerId: string, parentId?: string | null): Promise<Types.ObjectId | null> {
    const id = parentId ? new Types.ObjectId(parentId) : null;
    await this.resolveAncestors(new Types.ObjectId(ownerId), id);
    return id;
  }

  async assertNoDuplicateName(ownerId: string, parentId: Types.ObjectId | null, name: string, excludeId?: Types.ObjectId) {
    const filter: Record<string, unknown> = {
      ownerId: new Types.ObjectId(ownerId), parentId, normalizedName: this.normalizeName(name), isTrashed: false,
    };
    if (excludeId) filter._id = { $ne: excludeId };
    if (await this.driveItemModel.exists(filter)) throw new ConflictException('NAME_ALREADY_EXISTS');
  }

  async rename(args: { ownerId: Types.ObjectId; itemId: Types.ObjectId; name: string; expectedMetadataVersion: number }) {
    const current = await this.driveItemModel.findOne({ _id: args.itemId, ownerId: args.ownerId, isTrashed: false }).lean();
    if (!current) throw new NotFoundException('DRIVE_ITEM_NOT_FOUND');
    try {
      const updated = await this.driveItemModel.findOneAndUpdate(
        { _id: args.itemId, ownerId: args.ownerId, metadataVersion: args.expectedMetadataVersion, isTrashed: false },
        { $set: { name: args.name, normalizedName: this.normalizeName(args.name), extension: current.type === DriveItemType.FILE ? this.extractExtension(args.name) : null, lastModifiedAt: new Date() }, $inc: { metadataVersion: 1 } },
        { returnDocument: 'after' },
      );
      if (!updated) throw new ConflictException('DRIVE_ITEM_VERSION_CONFLICT');
      return updated;
    } catch (error) { this.rethrowDuplicate(error); }
  }

  async move(args: { ownerId: Types.ObjectId; itemId: Types.ObjectId; newParentId: Types.ObjectId | null; expectedMetadataVersion: number }) {
    const item = await this.driveItemModel.findOne({ _id: args.itemId, ownerId: args.ownerId, isTrashed: false });
    if (!item) throw new NotFoundException('DRIVE_ITEM_NOT_FOUND');
    if (args.newParentId?.equals(item._id)) throw new BadRequestException('CANNOT_MOVE_INTO_ITSELF');
    const newAncestors = await this.resolveAncestors(args.ownerId, args.newParentId);
    if (newAncestors.some((id) => id.equals(item._id))) throw new BadRequestException('CANNOT_MOVE_INTO_SUBTREE');
    await this.assertNoDuplicateName(args.ownerId.toString(), args.newParentId, item.name, item._id);

    const descendants = item.type === DriveItemType.FOLDER
      ? await this.driveItemModel.find({ ownerId: args.ownerId, ancestorIds: item._id }).select('_id ancestorIds').limit(MAX_SYNC_SUBTREE_ITEMS + 1).lean()
      : [];
    if (descendants.length > MAX_SYNC_SUBTREE_ITEMS) throw new ConflictException('SUBTREE_TOO_LARGE');
    const oldPrefixLength = item.ancestorIds.length + 1;
    const deepestRelativeDepth = descendants.reduce(
      (maximum, descendant) => Math.max(maximum, descendant.ancestorIds.length - oldPrefixLength),
      0,
    );
    if (newAncestors.length + 1 + deepestRelativeDepth > MAX_FOLDER_DEPTH) {
      throw new BadRequestException('MAX_DEPTH_EXCEEDED');
    }
    const updated = await this.driveItemModel.findOneAndUpdate(
      { _id: item._id, ownerId: args.ownerId, metadataVersion: args.expectedMetadataVersion, isTrashed: false },
      { $set: { parentId: args.newParentId, ancestorIds: newAncestors, lastModifiedAt: new Date() }, $inc: { metadataVersion: 1 } },
      { returnDocument: 'after' },
    );
    if (!updated) throw new ConflictException('DRIVE_ITEM_VERSION_CONFLICT');
    if (descendants.length) {
      await this.driveItemModel.bulkWrite(descendants.map((descendant) => ({ updateOne: {
        filter: { _id: descendant._id },
        update: { $set: { ancestorIds: [...newAncestors, item._id, ...descendant.ancestorIds.slice(oldPrefixLength)] } },
      } })));
    }
    if (!(item.parentId?.equals(args.newParentId) ?? args.newParentId === null)) {
      await this.adjustChildCount(item.parentId, -1);
      await this.adjustChildCount(args.newParentId, 1);
    }
    return updated;
  }

  async softDeleteRecursive(itemId: Types.ObjectId): Promise<Types.ObjectId[]> {
    const root = await this.driveItemModel.findOne({ _id: itemId, isTrashed: false });
    if (!root) return [];
    const descendants = await this.driveItemModel.find({ ownerId: root.ownerId, ancestorIds: root._id, isTrashed: false }).select('_id').limit(MAX_SYNC_SUBTREE_ITEMS + 1).lean();
    if (descendants.length > MAX_SYNC_SUBTREE_ITEMS) throw new ConflictException('SUBTREE_TOO_LARGE');
    const ids = [root._id, ...descendants.map((item) => item._id)];
    await this.driveItemModel.updateMany(
      { _id: { $in: ids }, isTrashed: false },
      { $set: { isTrashed: true, trashedAt: new Date(), trashedRootId: root._id }, $inc: { metadataVersion: 1 } },
    );
    await this.adjustChildCount(root.parentId, -1);
    return ids;
  }

  async listTrashRoots(ownerId: string) {
    return this.driveItemModel.find({ ownerId: new Types.ObjectId(ownerId), isTrashed: true, $expr: { $eq: ['$_id', '$trashedRootId'] } }).sort({ trashedAt: -1, _id: -1 }).lean();
  }

  async restoreRecursive(itemId: Types.ObjectId): Promise<Types.ObjectId[]> {
    const root = await this.driveItemModel.findOne({ _id: itemId, isTrashed: true, trashedRootId: itemId });
    if (!root) return [];
    await this.assertNoDuplicateName(root.ownerId.toString(), root.parentId, root.name, root._id);
    const docs = await this.driveItemModel.find({ ownerId: root.ownerId, trashedRootId: root._id, isTrashed: true }).select('_id').limit(MAX_SYNC_SUBTREE_ITEMS + 1).lean();
    if (docs.length > MAX_SYNC_SUBTREE_ITEMS) throw new ConflictException('SUBTREE_TOO_LARGE');
    const ids = docs.map((item) => item._id);
    await this.driveItemModel.updateMany(
      { _id: { $in: ids } },
      { $set: { isTrashed: false, trashedAt: null, trashedRootId: null }, $inc: { metadataVersion: 1 } },
    );
    await this.adjustChildCount(root.parentId, 1);
    return ids;
  }

  async hardDeleteRecursive(itemId: Types.ObjectId): Promise<{ deletedIds: Types.ObjectId[]; storageObjectIds: Types.ObjectId[] }> {
    const root = await this.driveItemModel.findOne({ _id: itemId, isTrashed: true });
    if (!root) return { deletedIds: [], storageObjectIds: [] };
    const docs = await this.driveItemModel.find({ ownerId: root.ownerId, trashedRootId: root.trashedRootId ?? root._id, isTrashed: true }).select('_id storageObjectId').limit(MAX_SYNC_SUBTREE_ITEMS + 1).lean();
    if (docs.length > MAX_SYNC_SUBTREE_ITEMS) throw new ConflictException('SUBTREE_TOO_LARGE');
    const deletedIds = docs.map((item) => item._id);
    const storageObjectIds = docs.flatMap((item) => item.storageObjectId ? [item.storageObjectId] : []);
    return { deletedIds, storageObjectIds };
  }

  async finalizeHardDelete(deletedIds: Types.ObjectId[]): Promise<void> {
    if (deletedIds.length) await this.driveItemModel.deleteMany({ _id: { $in: deletedIds }, isTrashed: true });
  }

  async getAncestorsIncludingSelf(itemId: Types.ObjectId) {
    const item = await this.driveItemModel.findOne({ _id: itemId, isTrashed: false }).lean();
    if (!item) return [];
    const ancestors = item.ancestorIds.length
      ? await this.driveItemModel.find({ _id: { $in: item.ancestorIds }, isTrashed: false }).lean()
      : [];
    const byId = new Map(ancestors.map((ancestor) => [ancestor._id.toString(), ancestor]));
    return [...item.ancestorIds.map((id) => byId.get(id.toString())).filter((value): value is NonNullable<typeof value> => Boolean(value)), item];
  }

  async reconcileChildCounts(batchSize = 100): Promise<number> {
    const folders = await this.driveItemModel.find({ type: DriveItemType.FOLDER, isTrashed: false }).select('_id').sort({ updatedAt: 1, _id: 1 }).limit(batchSize).lean();
    if (!folders.length) return 0;
    const ids = folders.map((folder) => folder._id);
    const counts = await this.driveItemModel.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { parentId: { $in: ids }, isTrashed: false, $or: [{ type: DriveItemType.FOLDER }, { type: DriveItemType.FILE, fileStatus: FileStatus.ACTIVE }] } },
      { $group: { _id: '$parentId', count: { $sum: 1 } } },
    ]);
    const byId = new Map(counts.map((row) => [row._id.toString(), row.count]));
    await this.driveItemModel.bulkWrite(folders.map((folder) => ({ updateOne: {
      filter: { _id: folder._id },
      update: { $set: { childCount: byId.get(folder._id.toString()) ?? 0 } },
    } })));
    return folders.length;
  }

  private rethrowDuplicate(error: unknown): never {
    if (this.isDuplicateKeyError(error)) {
      throw new ConflictException('NAME_ALREADY_EXISTS');
    }
    throw error;
  }

  private isDuplicateKeyError(error: unknown): error is { code: number } {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
  }

  private async adjustChildCount(parentId: Types.ObjectId | null, delta: 1 | -1): Promise<void> {
    if (!parentId) return;
    if (delta > 0) {
      await this.driveItemModel.updateOne({ _id: parentId, type: DriveItemType.FOLDER }, { $inc: { childCount: 1 } });
      return;
    }
    await this.driveItemModel.updateOne(
      { _id: parentId, type: DriveItemType.FOLDER },
      [{ $set: { childCount: { $max: [0, { $subtract: [{ $ifNull: ['$childCount', 0] }, 1] }] } } }],
    );
  }
}
