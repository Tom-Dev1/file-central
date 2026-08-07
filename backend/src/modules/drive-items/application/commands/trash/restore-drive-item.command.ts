import { ConflictException, Injectable } from "@nestjs/common";
import { Types } from "mongoose";
import { MAX_SYNC_SUBTREE_ITEMS } from "../../../domain/constants/drive-item.constants";
import { DriveItemNamePolicy } from "../../../domain/policies/drive-item-name.policy";
import { DriveItemRepository } from "../../../infrastructure/repositories/drive-item.repository";
import { DriveItemChildCountService } from "../../services/drive-item-child-count.service";
import { RestoreNameAvailabilityService } from "../../services/restore-name-availability.service";

@Injectable()
export class RestoreDriveItemCommand {
  constructor(
    private readonly items: DriveItemRepository,
    private readonly childCounts: DriveItemChildCountService,
    private readonly names: DriveItemNamePolicy,
    private readonly availability: RestoreNameAvailabilityService,
  ) {}

  async execute(itemId: Types.ObjectId): Promise<Types.ObjectId[]> {
    const root = await this.items.model.findOne({ _id: itemId, isTrashed: true, trashedRootId: itemId });
    if (!root) return [];
    const docs = await this.items.model.find({ ownerId: root.ownerId, trashedRootId: root._id, isTrashed: true })
      .select("_id parentId normalizedName").limit(MAX_SYNC_SUBTREE_ITEMS + 1).lean();
    if (docs.length > MAX_SYNC_SUBTREE_ITEMS) throw new ConflictException("SUBTREE_TOO_LARGE");
    await this.availability.assertAvailable(root.ownerId, docs);
    let restoredRoot;
    try {
      restoredRoot = await this.items.model.findOneAndUpdate(
        { _id: root._id, isTrashed: true, trashedRootId: root._id },
        { $set: { isTrashed: false, trashedAt: null, trashedRootId: null }, $inc: { metadataVersion: 1 } },
        { returnDocument: "after" },
      );
    } catch (error) {
      this.names.rethrowDuplicate(error, "RESTORE_NAME_COLLISION");
    }
    if (!restoredRoot) return [];
    const ids = docs.map((item) => item._id);
    const descendantIds = ids.filter((id) => !id.equals(root._id));
    if (descendantIds.length) {
      await this.items.model.updateMany(
        { _id: { $in: descendantIds }, isTrashed: true },
        { $set: { isTrashed: false, trashedAt: null, trashedRootId: null }, $inc: { metadataVersion: 1 } },
      );
    }
    await this.childCounts.adjust(restoredRoot.parentId, 1);
    return ids;
  }
}
