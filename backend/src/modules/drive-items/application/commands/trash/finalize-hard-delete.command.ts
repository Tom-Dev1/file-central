import { Injectable } from "@nestjs/common";
import { Types } from "mongoose";
import { DriveItemRepository } from "../../../infrastructure/repositories/drive-item.repository";

@Injectable()
export class FinalizeHardDeleteCommand {
  constructor(private readonly items: DriveItemRepository) {}

  async execute(deletedIds: Types.ObjectId[]): Promise<void> {
    if (!deletedIds.length) return;
    await this.items.model.deleteMany({ _id: { $in: deletedIds }, isTrashed: true });
  }
}
