import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Types } from "mongoose";
import { FinalizeHardDeleteCommand } from "../../drive-items/application/commands/trash/finalize-hard-delete.command";
import { RestoreDriveItemCommand } from "../../drive-items/application/commands/trash/restore-drive-item.command";
import { ListTrashRootsQuery } from "../../drive-items/application/queries/list-trash-roots.query";
import { PrepareHardDeleteQuery } from "../../drive-items/application/queries/prepare-hard-delete.query";
import { DriveItemLookupQuery } from "../../drive-items/application/queries/drive-item-lookup.query";
import { StorageObjectReference } from "../../drive-items/domain/types/storage-object-reference";
import { QuotaService } from "../../quota/quota.service";
import { SharesService } from "../../shares/shares.service";
import { StorageObjectsService } from "../../storage/storage-objects.services";

@Injectable()
export class TrashService {
  constructor(
    private readonly items: DriveItemLookupQuery,
    private readonly listTrashRoots: ListTrashRootsQuery,
    private readonly restoreDriveItem: RestoreDriveItemCommand,
    private readonly prepareHardDelete: PrepareHardDeleteQuery,
    private readonly finalizeHardDelete: FinalizeHardDeleteCommand,
    private readonly storageObjects: StorageObjectsService,
    private readonly quota: QuotaService,
    private readonly shares: SharesService
  ) {}

  list(ownerId: string) {
    return this.listTrashRoots.execute(ownerId);
  }

  private async assertOwnsTrashedItem(ownerId: string, itemId: Types.ObjectId) {
    const item = await this.items.findOne({
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
      const parent = await this.items.findById(item.parentId);
      if (parent?.isTrashed) throw new ForbiddenException("PARENT_STILL_TRASHED");
    }
    const restoredIds = await this.restoreDriveItem.execute(itemId);
    return { restoredIds: restoredIds.map((id) => id.toString()) };
  }

  async purgeOne(ownerId: string, itemIdValue: string) {
    const itemId = new Types.ObjectId(itemIdValue);
    await this.assertOwnsTrashedItem(ownerId, itemId);
    const result = await this.prepareHardDelete.execute(itemId);
    await this.deleteStorageObjects(result.storageObjects);
    await this.shares.cleanupItems(result.deletedIds);
    await this.finalizeHardDelete.execute(result.deletedIds);
    return { deletedIds: result.deletedIds.map((id) => id.toString()) };
  }

  async purgeAll(ownerId: string) {
    const roots = await this.listTrashRoots.execute(ownerId);
    const deletedIds: string[] = [];
    for (const root of roots) {
      const result = await this.prepareHardDelete.execute(root._id);
      await this.deleteStorageObjects(result.storageObjects);
      await this.shares.cleanupItems(result.deletedIds);
      await this.finalizeHardDelete.execute(result.deletedIds);
      deletedIds.push(...result.deletedIds.map((id) => id.toString()));
    }
    return { deletedIds };
  }

  private async deleteStorageObjects(objects: StorageObjectReference[]): Promise<void> {
    for (const object of objects) {
      await this.storageObjects.permanentDelete(object.storageObjectId);
      await this.quota.releaseUsed(
        object.ownerId,
        object.sizeBytes,
        `storage-object:${object.storageObjectId.toString()}:delete`,
      );
    }
  }
}
