import { BadRequestException, Injectable } from "@nestjs/common";
import { Types } from "mongoose";
import { DriveItemLookupQuery } from "./drive-item-lookup.query";

interface ListCursor {
  type: string;
  normalizedName: string;
  id: string;
}

@Injectable()
export class ListDriveItemsQuery {
  constructor(private readonly items: DriveItemLookupQuery) {}

  async execute(args: {
    ownerId: string;
    parentId: string | null;
    cursor?: string;
    limit: number;
  }) {
    const filter: Record<string, unknown> = {
      ownerId: new Types.ObjectId(args.ownerId),
      parentId: args.parentId ? new Types.ObjectId(args.parentId) : null,
      isTrashed: false,
    };
    if (args.cursor) {
      const value = this.decodeCursor(args.cursor);
      filter.$or = [
        { type: { $lt: value.type } },
        { type: value.type, normalizedName: { $gt: value.normalizedName } },
        {
          type: value.type,
          normalizedName: value.normalizedName,
          _id: { $gt: new Types.ObjectId(value.id) },
        },
      ];
    }
    const rows = await this.items.findMany(filter, {
      select: "+normalizedName",
      sort: { type: -1, normalizedName: 1, _id: 1 },
      limit: args.limit + 1,
    });
    const hasMore = rows.length > args.limit;
    const items = rows.slice(0, args.limit);
    const last = items.at(-1);
    return {
      items,
      limit: args.limit,
      nextCursor: hasMore && last
        ? Buffer.from(JSON.stringify({
            type: last.type,
            normalizedName: last.normalizedName,
            id: last._id.toString(),
          })).toString("base64url")
        : null,
    };
  }

  private decodeCursor(cursor: string): ListCursor {
    try {
      return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as ListCursor;
    } catch {
      throw new BadRequestException("INVALID_CURSOR");
    }
  }
}
