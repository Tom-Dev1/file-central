import { ConflictException, Injectable } from "@nestjs/common";
import { Types } from "mongoose";
import { MAX_SYNC_SUBTREE_ITEMS } from "../../domain/constants/drive-item.constants";
import { StorageObjectReference } from "../../domain/types/storage-object-reference";
import { DriveItemRepository } from "../../infrastructure/repositories/drive-item.repository";

@Injectable()
export class PrepareHardDeleteQuery {
  constructor(private readonly items: DriveItemRepository) {}

  async execute(itemId: Types.ObjectId): Promise<{
    deletedIds: Types.ObjectId[];
    storageObjects: StorageObjectReference[];
  }> {
    const root = await this.items.model.findOne({ _id: itemId, isTrashed: true });
    if (!root) return { deletedIds: [], storageObjects: [] };
    const docs = await this.items.model.find({
      ownerId: root.ownerId,
      trashedRootId: root.trashedRootId ?? root._id,
      isTrashed: true,
    }).select("_id ownerId storageObjectId sizeBytes").limit(MAX_SYNC_SUBTREE_ITEMS + 1).lean();
    if (docs.length > MAX_SYNC_SUBTREE_ITEMS) throw new ConflictException("SUBTREE_TOO_LARGE");
    return {
      deletedIds: docs.map((item) => item._id),
      storageObjects: docs.flatMap((item) => item.storageObjectId && item.sizeBytes !== null
        ? [{ storageObjectId: item.storageObjectId, ownerId: item.ownerId, sizeBytes: BigInt(item.sizeBytes) }]
        : []),
    };
  }
}
