import { BadRequestException, Injectable } from "@nestjs/common";
import { Types } from "mongoose";
import { DriveItemLookupQuery } from "./drive-item-lookup.query";

interface SearchCursor {
  lastModifiedAt: string;
  id: string;
}

@Injectable()
export class SearchDriveItemsQuery {
  constructor(private readonly items: DriveItemLookupQuery) {}

  async execute(args: {
    ownerId: string;
    query: string;
    type?: "file" | "folder";
    cursor?: string;
    limit: number;
  }) {
    const escaped = args.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const filter: Record<string, unknown> = {
      ownerId: new Types.ObjectId(args.ownerId),
      isTrashed: false,
      normalizedName: { $regex: escaped, $options: "i" },
    };
    if (args.type) filter.type = args.type;
    if (args.cursor) {
      const value = this.decodeCursor(args.cursor);
      const date = new Date(value.lastModifiedAt);
      if (Number.isNaN(date.getTime())) throw new BadRequestException("INVALID_CURSOR");
      filter.$or = [
        { lastModifiedAt: { $lt: date } },
        { lastModifiedAt: date, _id: { $lt: new Types.ObjectId(value.id) } },
      ];
    }
    const rows = await this.items.findMany(filter, {
      sort: { lastModifiedAt: -1, _id: -1 },
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
            lastModifiedAt: last.lastModifiedAt.toISOString(),
            id: last._id.toString(),
          })).toString("base64url")
        : null,
    };
  }

  private decodeCursor(cursor: string): SearchCursor {
    try {
      return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as SearchCursor;
    } catch {
      throw new BadRequestException("INVALID_CURSOR");
    }
  }
}
