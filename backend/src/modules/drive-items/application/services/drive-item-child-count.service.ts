import { Injectable, Logger } from "@nestjs/common";
import { Types } from "mongoose";
import { DriveItemType, FileStatus } from "../../domain/enums/drive-item.enum";
import { DriveItemRepository } from "../../infrastructure/repositories/drive-item.repository";

@Injectable()
export class DriveItemChildCountService {
  private readonly logger = new Logger(DriveItemChildCountService.name);

  constructor(private readonly items: DriveItemRepository) {}

  async adjust(
    parentId: Types.ObjectId | null,
    delta: 1 | -1,
  ): Promise<void> {
    if (!parentId) return;
    try {
      if (delta > 0) {
        await this.items.model.updateOne(
          { _id: parentId, type: DriveItemType.FOLDER },
          { $inc: { childCount: 1 } },
        );
        return;
      }
      await this.items.model.updateOne(
        { _id: parentId, type: DriveItemType.FOLDER },
        [
          {
            $set: {
              childCount: {
                $max: [
                  0,
                  { $subtract: [{ $ifNull: ["$childCount", 0] }, 1] },
                ],
              },
            },
          },
        ],
      );
    } catch (error) {
      // childCount is derived data. The reconciliation worker repairs drift;
      // a counter failure must not fail the primary drive operation.
      this.logger.warn(
        `Could not adjust child count for ${parentId}: ${String(error)}`,
      );
    }
  }

  async reconcile(batchSize = 100): Promise<number> {
    const folders = await this.items.model
      .find({ type: DriveItemType.FOLDER, isTrashed: false })
      .select("_id")
      .sort({ updatedAt: 1, _id: 1 })
      .limit(batchSize)
      .lean();
    if (!folders.length) return 0;
    const ids = folders.map((folder) => folder._id);
    const counts = await this.items.model.aggregate<{
      _id: Types.ObjectId;
      count: number;
    }>([
      {
        $match: {
          parentId: { $in: ids },
          isTrashed: false,
          $or: [
            { type: DriveItemType.FOLDER },
            { type: DriveItemType.FILE, fileStatus: FileStatus.ACTIVE },
          ],
        },
      },
      { $group: { _id: "$parentId", count: { $sum: 1 } } },
    ]);
    const byId = new Map(
      counts.map((row) => [row._id.toString(), row.count]),
    );
    await this.items.model.bulkWrite(
      folders.map((folder) => ({
        updateOne: {
          filter: { _id: folder._id },
          update: {
            $set: { childCount: byId.get(folder._id.toString()) ?? 0 },
          },
        },
      })),
    );
    return folders.length;
  }
}
