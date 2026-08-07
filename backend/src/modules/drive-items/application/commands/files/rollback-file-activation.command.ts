import { Injectable } from "@nestjs/common";
import { Types } from "mongoose";
import { DriveItemType, FileStatus } from "../../../domain/enums/drive-item.enum";
import { DriveItemRepository } from "../../../infrastructure/repositories/drive-item.repository";
import { DriveItemChildCountService } from "../../services/drive-item-child-count.service";

@Injectable()
export class RollbackFileActivationCommand {
  constructor(
    private readonly items: DriveItemRepository,
    private readonly childCounts: DriveItemChildCountService,
  ) {}

  async execute(driveItemId: Types.ObjectId): Promise<void> {
    const item = await this.items.model.findOneAndUpdate(
      { _id: driveItemId, type: DriveItemType.FILE, fileStatus: FileStatus.ACTIVE },
      { $set: { storageObjectId: null, fileStatus: FileStatus.FAILED, mimeType: null, sizeBytes: null, extension: null }, $inc: { metadataVersion: 1 } },
      { returnDocument: "before" },
    );
    if (item) await this.childCounts.adjust(item.parentId, -1);
  }
}
