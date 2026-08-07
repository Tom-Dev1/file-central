import { ConflictException, Injectable } from "@nestjs/common";
import { Types } from "mongoose";
import { MAX_SYNC_SUBTREE_ITEMS } from "../../../domain/constants/drive-item.constants";
import { DriveItemRepository } from "../../../infrastructure/repositories/drive-item.repository";
import { DriveItemChildCountService } from "../../services/drive-item-child-count.service";

@Injectable()
export class TrashDriveItemCommand {
  constructor(
    private readonly items: DriveItemRepository,
    private readonly childCounts: DriveItemChildCountService,
  ) {}

  async execute(itemId: Types.ObjectId): Promise<Types.ObjectId[]> {
    const root = await this.items.model.findOne({ _id: itemId, isTrashed: false });
    if (!root) return [];
    const descendants = await this.items.model.find({
      ownerId: root.ownerId,
      ancestorIds: root._id,
      isTrashed: false,
    }).select("_id").limit(MAX_SYNC_SUBTREE_ITEMS + 1).lean();
    if (descendants.length > MAX_SYNC_SUBTREE_ITEMS) throw new ConflictException("SUBTREE_TOO_LARGE");
    const trashedAt = new Date();
    const claimedRoot = await this.items.model.findOneAndUpdate(
      { _id: root._id, isTrashed: false },
      { $set: { isTrashed: true, trashedAt, trashedRootId: root._id }, $inc: { metadataVersion: 1 } },
      { returnDocument: "after" },
    );
    if (!claimedRoot) return [];
    const descendantIds = descendants.map((item) => item._id);
    if (descendantIds.length) {
      await this.items.model.updateMany(
        { _id: { $in: descendantIds }, isTrashed: false },
        { $set: { isTrashed: true, trashedAt, trashedRootId: root._id }, $inc: { metadataVersion: 1 } },
      );
    }
    await this.childCounts.adjust(claimedRoot.parentId, -1);
    return [root._id, ...descendantIds];
  }
}
