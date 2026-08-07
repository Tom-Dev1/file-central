import { Injectable } from "@nestjs/common";
import { Types } from "mongoose";
import { DriveItemType, FileStatus } from "../../../domain/enums/drive-item.enum";
import { DriveItemRepository } from "../../../infrastructure/repositories/drive-item.repository";

@Injectable()
export class MarkFileFailedCommand {
  constructor(private readonly items: DriveItemRepository) {}

  async execute(driveItemId: Types.ObjectId): Promise<void> {
    await this.items.model.updateOne(
      { _id: driveItemId, type: DriveItemType.FILE, fileStatus: { $ne: FileStatus.ACTIVE } },
      { $set: { fileStatus: FileStatus.FAILED } },
    );
  }
}
