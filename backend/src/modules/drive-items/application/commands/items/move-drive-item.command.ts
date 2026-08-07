import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Types } from "mongoose";
import { MAX_FOLDER_DEPTH, MAX_SYNC_SUBTREE_ITEMS } from "../../../domain/constants/drive-item.constants";
import { DriveItemType } from "../../../domain/enums/drive-item.enum";
import { DriveItemNamePolicy } from "../../../domain/policies/drive-item-name.policy";
import { DriveItemRepository } from "../../../infrastructure/repositories/drive-item.repository";
import { DriveItemChildCountService } from "../../services/drive-item-child-count.service";
import { DriveItemNameAvailabilityService } from "../../services/drive-item-name-availability.service";
import { DriveItemParentService } from "../../services/drive-item-parent.service";

@Injectable()
export class MoveDriveItemCommand {
  constructor(
    private readonly items: DriveItemRepository,
    private readonly names: DriveItemNamePolicy,
    private readonly availability: DriveItemNameAvailabilityService,
    private readonly parents: DriveItemParentService,
    private readonly childCounts: DriveItemChildCountService,
  ) {}

  async execute(args: {
    ownerId: Types.ObjectId;
    itemId: Types.ObjectId;
    newParentId: Types.ObjectId | null;
    expectedMetadataVersion: number;
  }) {
    const item = await this.items.model.findOne({ _id: args.itemId, ownerId: args.ownerId, isTrashed: false });
    if (!item) throw new NotFoundException("DRIVE_ITEM_NOT_FOUND");
    if (args.newParentId?.equals(item._id)) throw new BadRequestException("CANNOT_MOVE_INTO_ITSELF");
    const newAncestors = await this.parents.resolveAncestors(args.ownerId, args.newParentId);
    if (newAncestors.some((id) => id.equals(item._id))) throw new BadRequestException("CANNOT_MOVE_INTO_SUBTREE");
    await this.availability.assertAvailable(args.ownerId, args.newParentId, item.name, item._id);
    const descendants = item.type === DriveItemType.FOLDER
      ? await this.items.model.find({ ownerId: args.ownerId, ancestorIds: item._id })
        .select("_id ancestorIds").limit(MAX_SYNC_SUBTREE_ITEMS + 1).lean()
      : [];
    if (descendants.length > MAX_SYNC_SUBTREE_ITEMS) throw new ConflictException("SUBTREE_TOO_LARGE");
    const oldPrefixLength = item.ancestorIds.length + 1;
    const deepestRelativeDepth = descendants.reduce(
      (maximum, descendant) => Math.max(maximum, descendant.ancestorIds.length - oldPrefixLength),
      0,
    );
    if (newAncestors.length + 1 + deepestRelativeDepth > MAX_FOLDER_DEPTH) {
      throw new BadRequestException("MAX_DEPTH_EXCEEDED");
    }
    let updated;
    try {
      updated = await this.items.model.findOneAndUpdate(
        { _id: item._id, ownerId: args.ownerId, metadataVersion: args.expectedMetadataVersion, isTrashed: false },
        { $set: { parentId: args.newParentId, ancestorIds: newAncestors, lastModifiedAt: new Date() }, $inc: { metadataVersion: 1 } },
        { returnDocument: "after" },
      );
    } catch (error) {
      this.names.rethrowDuplicate(error);
    }
    if (!updated) throw new ConflictException("DRIVE_ITEM_VERSION_CONFLICT");
    if (descendants.length) {
      await this.items.model.bulkWrite(descendants.map((descendant) => ({
        updateOne: { filter: { _id: descendant._id }, update: { $set: { ancestorIds: [
          ...newAncestors,
          item._id,
          ...descendant.ancestorIds.slice(oldPrefixLength),
        ] } } },
      })));
    }
    if (!(item.parentId?.equals(args.newParentId) ?? args.newParentId === null)) {
      await this.childCounts.adjust(item.parentId, -1);
      await this.childCounts.adjust(args.newParentId, 1);
    }
    return updated;
  }
}
