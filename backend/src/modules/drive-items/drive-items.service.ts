import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { DriveItem, DriveItemDocument, DriveItemType } from "./schemas/drive-item.schema";
import { FileStatus } from "./enums/drive-item.enum";

@Injectable()
export class DriveItemsService {
  constructor(@InjectModel(DriveItem.name) private driveItemModel: Model<DriveItemDocument>) {}

  get model() {
    return this.driveItemModel;
  }

  async createPlaceholder(args: { ownerId: Types.ObjectId; parentId: Types.ObjectId | null; name: string }) {
    const parent = args.parentId
      ? await this.driveItemModel.findOne({ _id: args.parentId, ownerId: args.ownerId, type: DriveItemType.FOLDER, isTrashed: false }).lean()
      : null;
    if (args.parentId && !parent) throw new NotFoundException("Parent folder not found");
    const item = await this.driveItemModel.create({
      ownerId: args.ownerId,
      parentId: args.parentId,
      ancestorIds: parent ? [...parent.ancestorIds, parent._id] : [],
      name: args.name,
      normalizedName: args.name.normalize("NFC").trim().toLocaleLowerCase("en-US"),
      type: DriveItemType.FILE,
      fileStatus: FileStatus.UPLOADING,
      childCount: null,
    });
    return { id: item._id };
  }

  async activateFile(args: { driveItemId: Types.ObjectId; storageObjectId: Types.ObjectId; mimeType: string; sizeBytes: bigint; extension: string | null }) {
    await this.driveItemModel.updateOne(
      { _id: args.driveItemId, fileStatus: { $in: [FileStatus.UPLOADING, FileStatus.PROCESSING] } },
      { $set: { storageObjectId: args.storageObjectId, fileStatus: FileStatus.ACTIVE, mimeType: args.mimeType, sizeBytes: args.sizeBytes, extension: args.extension, lastModifiedAt: new Date() }, $inc: { metadataVersion: 1 } },
    );
  }

  async markFailed(driveItemId: Types.ObjectId) {
    await this.driveItemModel.updateOne({ _id: driveItemId, fileStatus: { $ne: FileStatus.ACTIVE } }, { $set: { fileStatus: FileStatus.FAILED } });
  }

  /**
   * Validates that `parentId` (if provided) exists, belongs to `ownerId`,
   * is a folder, and is not soft-deleted. Returns null for root (parentId
   * omitted/null).
   */
  async assertValidParent(ownerId: string, parentId?: string | null): Promise<Types.ObjectId | null> {
    if (!parentId) return null;

    const parent = await this.driveItemModel.findOne({
      _id: parentId,
      ownerId: new Types.ObjectId(ownerId),
      isDeleted: false,
    });

    if (!parent) {
      throw new NotFoundException("Parent folder not found");
    }
    if (parent.type !== DriveItemType.FOLDER) {
      throw new BadRequestException("parentId does not point to a folder");
    }
    return parent._id;
  }

  /**
   * Prevents two active items with the same name under the same parent
   * for the same owner (MVP policy: block duplicates rather than
   * auto-renaming to "name (1)").
   */
  async assertNoDuplicateName(
    ownerId: string,
    parentId: Types.ObjectId | null,
    name: string,
    excludeId?: Types.ObjectId
  ): Promise<void> {
    const filter: any = {
      ownerId: new Types.ObjectId(ownerId),
      parentId,
      name,
      isDeleted: false,
    };
    if (excludeId) filter._id = { $ne: excludeId };

    const dup = await this.driveItemModel.findOne(filter);
    if (dup) {
      throw new ConflictException(`An item named "${name}" already exists in this folder`);
    }
  }

  /**
   * Guards against moving a folder into itself or into one of its own
   * descendants, which would create a cycle in the tree.
   */
  async assertNotCircularMove(itemId: Types.ObjectId, newParentId: Types.ObjectId | null): Promise<void> {
    if (!newParentId) return;
    if (newParentId.equals(itemId)) {
      throw new BadRequestException("Cannot move a folder into itself");
    }

    let current: { _id: Types.ObjectId; parentId: Types.ObjectId | null } | null = await this.driveItemModel
      .findById(newParentId)
      .select("_id parentId")
      .lean();

    let depth = 0;
    while (current && depth < 1000) {
      if (current._id.equals(itemId)) {
        throw new BadRequestException("Cannot move a folder into one of its own subfolders");
      }
      if (!current.parentId) break;
      current = await this.driveItemModel.findById(current.parentId).select("_id parentId").lean();
      depth++;
    }
  }

  /**
   * Soft-deletes an item and, if it's a folder, recursively soft-deletes
   * all descendants (files and subfolders). Returns the ids that were
   * newly soft-deleted (useful for cascading share cleanup later if desired).
   */
  async softDeleteRecursive(itemId: Types.ObjectId): Promise<Types.ObjectId[]> {
    const deletedIds: Types.ObjectId[] = [];
    const stack: Types.ObjectId[] = [itemId];

    while (stack.length > 0) {
      const currentId = stack.pop() as Types.ObjectId;
      const item = await this.driveItemModel.findOne({ _id: currentId, isDeleted: false });
      if (!item) continue;

      item.isDeleted = true;
      item.deletedAt = new Date();
      await item.save();
      deletedIds.push(currentId);

      if (item.type === DriveItemType.FOLDER) {
        const children = await this.driveItemModel.find({ parentId: currentId, isDeleted: false }).select("_id").lean();
        stack.push(...children.map((c) => c._id));
      }
    }

    return deletedIds;
  }

  /**
   * Lists the "roots" of the trash tree for an owner: trashed items whose
   * immediate parent is either root, an active (non-trashed) folder, or
   * a folder that no longer exists. Mirrors Google Drive's trash view,
   * which shows a deleted folder once rather than every descendant file
   * individually.
   */
  async listTrashRoots(ownerId: string) {
    const allTrashed = await this.driveItemModel
      .find({ ownerId: new Types.ObjectId(ownerId), isDeleted: true })
      .sort({ deletedAt: -1 })
      .lean();

    const trashedIds = new Set(allTrashed.map((i) => i._id.toString()));
    return allTrashed.filter((item) => !item.parentId || !trashedIds.has(item.parentId.toString()));
  }

  /**
   * Restores a trashed item. If it's a folder, cascades to every
   * currently-trashed descendant too (simple MVP policy: restoring a
   * folder brings back everything that's inside it right now).
   */
  async restoreRecursive(itemId: Types.ObjectId): Promise<Types.ObjectId[]> {
    const restoredIds: Types.ObjectId[] = [];
    const stack: Types.ObjectId[] = [itemId];

    while (stack.length > 0) {
      const currentId = stack.pop() as Types.ObjectId;
      const item = await this.driveItemModel.findOne({ _id: currentId, isDeleted: true });
      if (!item) continue;

      item.isDeleted = false;
      item.deletedAt = null;
      await item.save();
      restoredIds.push(currentId);

      if (item.type === DriveItemType.FOLDER) {
        const children = await this.driveItemModel.find({ parentId: currentId, isDeleted: true }).select("_id").lean();
        stack.push(...children.map((c) => c._id));
      }
    }

    return restoredIds;
  }

  /**
   * Permanently deletes a trashed item and, if it's a folder, its entire
   * trashed subtree. Returns the objectKeys of any files that were
   * removed, so the caller can also delete them from MinIO.
   */
  async hardDeleteRecursive(itemId: Types.ObjectId): Promise<{ deletedIds: Types.ObjectId[]; objectKeys: string[] }> {
    const deletedIds: Types.ObjectId[] = [];
    const objectKeys: string[] = [];
    const stack: Types.ObjectId[] = [itemId];

    while (stack.length > 0) {
      const currentId = stack.pop() as Types.ObjectId;
      const item = await this.driveItemModel.findOne({ _id: currentId, isDeleted: true });
      if (!item) continue;

      if (item.type === DriveItemType.FOLDER) {
        const children = await this.driveItemModel.find({ parentId: currentId, isDeleted: true }).select("_id").lean();
        stack.push(...children.map((c) => c._id));
      } else if (item.objectKey) {
        objectKeys.push(item.objectKey);
      }

      await this.driveItemModel.deleteOne({ _id: currentId });
      deletedIds.push(currentId);
    }

    return { deletedIds, objectKeys };
  }
  async getAncestorsIncludingSelf(itemId: Types.ObjectId) {
    const chain: DriveItemDocument[] = [];
    let current = await this.driveItemModel.findOne({ _id: itemId, isDeleted: false });
    if (!current) return chain;
    chain.push(current);

    let depth = 0;
    while (current?.parentId && depth < 1000) {
      const parent = await this.driveItemModel.findOne({
        _id: current.parentId,
        isDeleted: false,
      });
      if (!parent) break;
      chain.push(parent);
      current = parent;
      depth++;
    }

    return chain.reverse(); // was item-first while walking up - flip to root-first
  }
}
