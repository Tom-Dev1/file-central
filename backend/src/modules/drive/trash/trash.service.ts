import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Types } from "mongoose";
import { DriveItemsService } from "../../drive-items/drive-items.service";
import { MinioService } from "../../storage/minio.service";

@Injectable()
export class TrashService {
  constructor(private driveItemsService: DriveItemsService, private minioService: MinioService) {}

  async list(ownerId: string) {
    return this.driveItemsService.listTrashRoots(ownerId);
  }

  private async assertOwnsTrashedItem(ownerId: string, itemId: Types.ObjectId) {
    const item = await this.driveItemsService.model.findOne({ _id: itemId, isDeleted: true });
    if (!item) throw new NotFoundException("Item not found in trash");
    if (item.ownerId.toString() !== ownerId) {
      throw new ForbiddenException("Only the owner can manage this trashed item");
    }
    return item;
  }

  async restore(ownerId: string, itemId: string) {
    const objectId = new Types.ObjectId(itemId);
    await this.assertOwnsTrashedItem(ownerId, objectId);

    // Restoring shouldn't silently succeed while leaving the item invisible
    // because its parent folder is still trashed - require restoring the
    // parent first, same as Google Drive.
    const item = await this.driveItemsService.model.findById(objectId);
    if (item?.parentId) {
      const parent = await this.driveItemsService.model.findById(item.parentId);
      if (parent?.isDeleted) {
        throw new ForbiddenException("Parent folder is still in trash - restore the parent folder first");
      }
    }

    const restoredIds = await this.driveItemsService.restoreRecursive(objectId);
    return { restoredIds: restoredIds.map((id) => id.toString()) };
  }

  async purgeOne(ownerId: string, itemId: string) {
    const objectId = new Types.ObjectId(itemId);
    await this.assertOwnsTrashedItem(ownerId, objectId);

    const { deletedIds, objectKeys } = await this.driveItemsService.hardDeleteRecursive(objectId);
    if (objectKeys.length > 0) {
      await this.minioService.removeObjects(objectKeys);
    }
    return { deletedIds: deletedIds.map((id) => id.toString()) };
  }

  async purgeAll(ownerId: string) {
    const roots = await this.driveItemsService.listTrashRoots(ownerId);
    const allDeletedIds: string[] = [];
    const allObjectKeys: string[] = [];

    for (const root of roots) {
      const { deletedIds, objectKeys } = await this.driveItemsService.hardDeleteRecursive(root._id);
      allDeletedIds.push(...deletedIds.map((id) => id.toString()));
      allObjectKeys.push(...objectKeys);
    }

    if (allObjectKeys.length > 0) {
      await this.minioService.removeObjects(allObjectKeys);
    }
    return { deletedIds: allDeletedIds };
  }
}
