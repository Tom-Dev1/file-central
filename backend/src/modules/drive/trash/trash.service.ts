import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Types } from "mongoose";
import { DriveItemsService } from "../../drive-items/drive-items.service";
import { QuotaService } from "../../quota/quota.service";
import { SharesService } from "../../shares/shares.service";
import { StorageObjectsService } from "src/modules/storage/storage-objects.services";

@Injectable()
export class TrashService {
  constructor(
    private readonly driveItems: DriveItemsService,
    private readonly storageObjects: StorageObjectsService,
    private readonly quota: QuotaService,
    private readonly shares: SharesService
  ) {}

  list(ownerId: string) {
    return this.driveItems.listTrashRoots(ownerId);
  }

  private async assertOwnsTrashedItem(ownerId: string, itemId: Types.ObjectId) {
    const item = await this.driveItems.model.findOne({
      _id: itemId,
      ownerId: new Types.ObjectId(ownerId),
      isTrashed: true,
    });
    if (!item) throw new NotFoundException("ITEM_NOT_FOUND_IN_TRASH");
    if (!item.trashedRootId?.equals(item._id)) throw new ForbiddenException("RESTORE_TRASH_ROOT_INSTEAD");
    return item;
  }

  async restore(ownerId: string, itemIdValue: string) {
    const itemId = new Types.ObjectId(itemIdValue);
    const item = await this.assertOwnsTrashedItem(ownerId, itemId);
    if (item.parentId) {
      const parent = await this.driveItems.model.findById(item.parentId).lean();
      if (parent?.isTrashed) throw new ForbiddenException("PARENT_STILL_TRASHED");
    }
    const restoredIds = await this.driveItems.restoreRecursive(itemId);
    return { restoredIds: restoredIds.map((id) => id.toString()) };
  }

  async purgeOne(ownerId: string, itemIdValue: string) {
    const itemId = new Types.ObjectId(itemIdValue);
    await this.assertOwnsTrashedItem(ownerId, itemId);
    const result = await this.driveItems.hardDeleteRecursive(itemId);
    // await this.deleteStorageObjects(result.storageObjectIds);
    await this.shares.cleanupItems(result.deletedIds);
    await this.driveItems.finalizeHardDelete(result.deletedIds);
    return { deletedIds: result.deletedIds.map((id) => id.toString()) };
  }

  async purgeAll(ownerId: string) {
    const roots = await this.driveItems.listTrashRoots(ownerId);
    const deletedIds: string[] = [];
    for (const root of roots) {
      const result = await this.driveItems.hardDeleteRecursive(root._id);
      // await this.deleteStorageObjects(result.storageObjectIds);
      await this.shares.cleanupItems(result.deletedIds);
      await this.driveItems.finalizeHardDelete(result.deletedIds);
      deletedIds.push(...result.deletedIds.map((id) => id.toString()));
    }
    return { deletedIds };
  }

  // private async deleteStorageObjects(ids: Types.ObjectId[]): Promise<void> {
  //   for (const id of ids) {
  //     const deleted = await this.storageObjects.permanentDelete(id);
  //     if (deleted) await this.quota.releaseUsed(deleted.ownerId, deleted.sizeBytes, `storage-object:${id.toString()}:delete`);
  //   }
  // }
}
