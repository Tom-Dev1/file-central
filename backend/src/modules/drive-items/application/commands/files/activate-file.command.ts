import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Types } from "mongoose";
import { DriveItemType, FileStatus } from "../../../domain/enums/drive-item.enum";
import { DriveItemRepository } from "../../../infrastructure/repositories/drive-item.repository";
import { DriveItemChildCountService } from "../../services/drive-item-child-count.service";

@Injectable()
export class ActivateFileCommand {
  constructor(
    private readonly items: DriveItemRepository,
    private readonly childCounts: DriveItemChildCountService,
  ) {}

  async execute(args: {
    driveItemId: Types.ObjectId;
    storageObjectId: Types.ObjectId;
    mimeType: string;
    sizeBytes: bigint;
    extension: string | null;
  }): Promise<void> {
    const item = await this.items.model.findOneAndUpdate(
      { _id: args.driveItemId, type: DriveItemType.FILE, fileStatus: { $in: [FileStatus.UPLOADING, FileStatus.PROCESSING] } },
      { $set: {
        storageObjectId: args.storageObjectId,
        fileStatus: FileStatus.ACTIVE,
        mimeType: args.mimeType,
        sizeBytes: args.sizeBytes,
        extension: args.extension,
        lastModifiedAt: new Date(),
      }, $inc: { metadataVersion: 1 } },
      { returnDocument: "after" },
    );
    if (!item) {
      const current = await this.items.model.findOne({ _id: args.driveItemId, type: DriveItemType.FILE })
        .select("fileStatus storageObjectId").lean();
      if (current?.fileStatus === FileStatus.ACTIVE && current.storageObjectId?.equals(args.storageObjectId)) return;
      if (current?.fileStatus === FileStatus.ACTIVE) throw new ConflictException("DRIVE_ITEM_ALREADY_ACTIVE");
      throw new NotFoundException("DRIVE_ITEM_NOT_FOUND");
    }
    await this.childCounts.adjust(item.parentId, 1);
  }
}
