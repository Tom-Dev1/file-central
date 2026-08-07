import { Injectable } from "@nestjs/common";
import { QueryFilter, Types } from "mongoose";
import { DriveItemRepository } from "../../infrastructure/repositories/drive-item.repository";
import { DriveItem } from "../../infrastructure/schemas/drive-item.schema";

interface DriveItemQueryOptions {
  select?: string;
  sort?: Record<string, 1 | -1>;
  limit?: number;
}

@Injectable()
export class DriveItemLookupQuery {
  constructor(private readonly items: DriveItemRepository) {}

  findMany(filter: QueryFilter<DriveItem>, options: DriveItemQueryOptions = {}) {
    const query = this.items.model.find(filter);
    if (options.select) query.select(options.select);
    if (options.sort) query.sort(options.sort);
    if (options.limit !== undefined) query.limit(options.limit);
    return query.lean();
  }

  findOne(filter: QueryFilter<DriveItem>, select?: string) {
    const query = this.items.model.findOne(filter);
    if (select) query.select(select);
    return query.lean();
  }

  findById(itemId: Types.ObjectId, select?: string) {
    const query = this.items.model.findById(itemId);
    if (select) query.select(select);
    return query.lean();
  }
}
