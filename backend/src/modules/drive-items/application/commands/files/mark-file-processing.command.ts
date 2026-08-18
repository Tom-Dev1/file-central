import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Types } from "mongoose";
import { DriveItemType, FileStatus } from "../../../domain/enums/drive-item.enum";
import { DriveItemRepository } from "../../../infrastructure/repositories/drive-item.repository";

@Injectable()
export class MarkFileProcessingCommand {
  constructor(private readonly items: DriveItemRepository) {}

  async execute(driveItemId: Types.ObjectId): Promise<void> {
    const item = await this.items.model.findOneAndUpdate(
      {
        _id: driveItemId,
        type: DriveItemType.FILE,
        fileStatus: FileStatus.UPLOADING,
      },
      { $set: { fileStatus: FileStatus.PROCESSING } },
      { returnDocument: "after" },
    );
    if (item) return;

    const current = await this.items.model
      .findOne({ _id: driveItemId, type: DriveItemType.FILE })
      .select("fileStatus")
      .lean();
    if (!current) throw new NotFoundException("DRIVE_ITEM_NOT_FOUND");
    if (current.fileStatus === FileStatus.PROCESSING) return;
    throw new ConflictException(`Cannot process file in status ${current.fileStatus}`);
  }
}
