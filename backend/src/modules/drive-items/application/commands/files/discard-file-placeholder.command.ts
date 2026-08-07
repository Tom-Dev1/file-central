import { Injectable } from "@nestjs/common";
import { Types } from "mongoose";
import { DriveItemType, FileStatus } from "../../../domain/enums/drive-item.enum";
import { DriveItemRepository } from "../../../infrastructure/repositories/drive-item.repository";

@Injectable()
export class DiscardFilePlaceholderCommand {
  constructor(private readonly items: DriveItemRepository) {}

  async execute(driveItemId: Types.ObjectId): Promise<void> {
    await this.items.model.deleteOne({
      _id: driveItemId,
      type: DriveItemType.FILE,
      fileStatus: { $in: [FileStatus.UPLOADING, FileStatus.FAILED] },
      storageObjectId: null,
    });
  }
}
