import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { DriveItem } from "../schemas/drive-item.schema";

@Injectable()
export class DriveItemRepository {
  constructor(
    @InjectModel(DriveItem.name)
    readonly model: Model<DriveItem>,
  ) {}
}
