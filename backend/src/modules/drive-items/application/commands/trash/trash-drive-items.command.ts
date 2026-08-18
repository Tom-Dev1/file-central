import { ConflictException, Injectable } from "@nestjs/common";
import { Types } from "mongoose";

import { MAX_SYNC_SUBTREE_ITEMS } from "../../../domain/constants/drive-item.constants";
import { DriveItemRepository } from "../../../infrastructure/repositories/drive-item.repository";
import { DriveItemChildCountService } from "../../services/drive-item-child-count.service";

@Injectable()
export class TrashDriveItemsCommand {
  constructor(
    private readonly items: DriveItemRepository,
    private readonly childCounts: DriveItemChildCountService,
  ) {}

  async execute(itemIds: Types.ObjectId[]): Promise<Types.ObjectId[]> {
    const uniqueIds = Array.from(new Map(itemIds.map((id) => [id.toString(), id])).values());
    if (!uniqueIds.length) return [];

    const candidates = await this.items.model
      .find({ _id: { $in: uniqueIds }, isTrashed: false })
      .select("_id ownerId parentId ancestorIds")
      .lean();

    const selectedIds = new Set(candidates.map((item) => item._id.toString()));
    const roots = candidates.filter(
      (item) => !item.ancestorIds.some((ancestorId) => selectedIds.has(ancestorId.toString())),
    );

    if (!roots.length) return [];
    if (roots.length > MAX_SYNC_SUBTREE_ITEMS) {
      throw new ConflictException("SUBTREE_TOO_LARGE");
    }

    const descendantLimit = MAX_SYNC_SUBTREE_ITEMS - roots.length;
    const descendants = await this.items.model
      .find({
        isTrashed: false,
        $or: roots.map((root) => ({ ownerId: root.ownerId, ancestorIds: root._id })),
      })
      .select("_id ancestorIds")
      .limit(descendantLimit + 1)
      .lean();

    if (roots.length + descendants.length > MAX_SYNC_SUBTREE_ITEMS) {
      throw new ConflictException("SUBTREE_TOO_LARGE");
    }

    const rootById = new Map(roots.map((root) => [root._id.toString(), root]));
    const descendantIdsByRoot = new Map<string, Types.ObjectId[]>();

    for (const descendant of descendants) {
      const rootId = descendant.ancestorIds
        .map((ancestorId) => ancestorId.toString())
        .find((ancestorId) => rootById.has(ancestorId));

      if (!rootId) continue;

      const descendantIds = descendantIdsByRoot.get(rootId) ?? [];
      descendantIds.push(descendant._id);
      descendantIdsByRoot.set(rootId, descendantIds);
    }

    const trashedAt = new Date();
    const deletedIds: Types.ObjectId[] = [];

    for (const root of roots) {
      const claimedRoot = await this.items.model.findOneAndUpdate(
        { _id: root._id, isTrashed: false },
        {
          $set: { isTrashed: true, trashedAt, trashedRootId: root._id },
          $inc: { metadataVersion: 1 },
        },
        { returnDocument: "after" },
      );

      if (!claimedRoot) continue;

      const descendantIds = descendantIdsByRoot.get(root._id.toString()) ?? [];
      if (descendantIds.length) {
        await this.items.model.updateMany(
          { _id: { $in: descendantIds }, isTrashed: false },
          {
            $set: { isTrashed: true, trashedAt, trashedRootId: root._id },
            $inc: { metadataVersion: 1 },
          },
        );
      }

      await this.childCounts.adjust(claimedRoot.parentId, -1);
      deletedIds.push(root._id, ...descendantIds);
    }

    return deletedIds;
  }
}
