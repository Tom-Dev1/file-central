import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { DriveItem, DriveItemDocument, DriveItemType } from "./schemas/drive-item.schema";

@Injectable()
export class DriveItemsService {
  constructor(@InjectModel(DriveItem.name) private driveItemModel: Model<DriveItemDocument>) {}

  get model() {
    return this.driveItemModel;
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
   * for the same owner. Used by rename/move, which surface the conflict
   * to the user instead of silently renaming. Upload/create-folder use
   * resolveUniqueName instead.
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
   * Google-Drive-style auto-rename: if `name` is free under the parent,
   * returns it unchanged; otherwise returns "base 1.ext", "base 2.ext", ...
   * where base/ext are split on the LAST dot (so "Whale.png" -> "Whale 1.png"
   * and "Dockerfile" -> "Dockerfile 1"). Always uses max+1, never back-fills
   * gaps left by deleted items. Used by upload and create-folder.
   */
  async resolveUniqueName(
    ownerId: string,
    parentId: Types.ObjectId | null,
    name: string,
    excludeId?: Types.ObjectId
  ): Promise<string> {
    const filter: any = {
      ownerId: new Types.ObjectId(ownerId),
      parentId,
      isDeleted: false,
    };
    if (excludeId) filter._id = { $ne: excludeId };

    const existing = await this.driveItemModel.find(filter).select("name").lean();
    const takenNames = new Set(existing.map((item) => item.name));

    if (!takenNames.has(name)) {
      return name;
    }

    const { baseName, extension } = this.parseBaseAndExt(name);
    for (let i = 1; i < 1000; i++) {
      const candidate = `${baseName} ${i}${extension}`;
      if (!takenNames.has(candidate)) {
        return candidate;
      }
    }
    // Extremely unlikely (would need 999 same-name siblings), but avoid an
    // infinite loop and give a deterministic fallback.
    return `${baseName} 1000${extension}`;
  }

  /**
   * Splits a filename into base name + dotted extension on the LAST dot.
   * "Whale.png" -> { baseName: "Whale", extension: ".png" }
   * "archive.tar.gz" -> { baseName: "archive.tar", extension: ".gz" }
   * "Dockerfile" -> { baseName: "Dockerfile", extension: "" }
   * Hidden-file style like ".gitignore" keeps the dot in the base name.
   */
  private parseBaseAndExt(name: string): { baseName: string; extension: string } {
    const lastDotIndex = name.lastIndexOf(".");
    if (lastDotIndex <= 0) {
      return { baseName: name, extension: "" };
    }
    return {
      baseName: name.slice(0, lastDotIndex),
      extension: name.slice(lastDotIndex),
    };
  }

  /**
   * Marks an item as "just viewed" by stamping lastViewedAt. Used by the
   * read paths (download / preview-link / get-by-id). Critically uses
   * `timestamps: false` so Mongoose does NOT auto-bump `updatedAt` on a
   * mere view - that would corrupt the "last modified" column.
   * Callers fire this fire-and-forget; a DB hiccup here must not fail
   * the user's download/preview.
   */
  async touchViewed(itemId: Types.ObjectId): Promise<void> {
    await this.driveItemModel.findByIdAndUpdate(
      itemId,
      { $set: { lastViewedAt: new Date() } },
      { timestamps: false }
    );
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
