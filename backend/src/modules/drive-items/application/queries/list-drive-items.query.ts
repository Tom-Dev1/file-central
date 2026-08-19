import { BadRequestException, Injectable } from "@nestjs/common";
import { Types } from "mongoose";
import {
  DriveItemSortBy,
  DriveItemSortDirection,
  DriveItemType,
} from "../../domain/enums/drive-item.enum";
import { DriveItemLookupQuery } from "./drive-item-lookup.query";

interface EncodedCursor {
  version?: number;
  context?: string;
  sort?: DriveItemSortBy;
  direction?: DriveItemSortDirection;
  type?: DriveItemType;
  normalizedName?: string;
  lastModifiedAt?: string;
  sizeBytes?: string | null;
  id?: string;
}

type CursorFilter = Record<string, unknown>;

interface CursorItem {
  _id: Types.ObjectId;
  type: DriveItemType;
  normalizedName: string;
  lastModifiedAt: Date;
  sizeBytes: bigint | null;
}

@Injectable()
export class ListDriveItemsQuery {
  constructor(private readonly items: DriveItemLookupQuery) {}

  async execute(args: {
    ownerId: string;
    parentId?: string | null;
    starredOnly?: boolean;
    cursor?: string;
    limit: number;
    sort: DriveItemSortBy;
    direction: DriveItemSortDirection;
  }) {
    const cursorContext = this.getCursorContext(args.parentId, args.starredOnly);
    const filter: Record<string, unknown> = {
      ownerId: new Types.ObjectId(args.ownerId),
      isTrashed: false,
    };

    if (args.parentId !== undefined) {
      filter.parentId = args.parentId ? new Types.ObjectId(args.parentId) : null;
    }

    if (args.starredOnly) {
      filter.isStarred = true;
    }

    if (args.cursor) {
      Object.assign(
        filter,
        this.buildCursorFilter(
          args.cursor,
          args.sort,
          args.direction,
          cursorContext,
        ),
      );
    }

    const rows = await this.items.findMany(filter, {
      select:
        args.sort === DriveItemSortBy.NAME || args.sort === DriveItemSortBy.TYPE
          ? "+normalizedName"
          : undefined,
      sort: this.getMongoSort(args.sort, args.direction),
      limit: args.limit + 1,
    });
    const hasMore = rows.length > args.limit;
    const items = rows.slice(0, args.limit);
    const last = items.at(-1);

    return {
      items,
      limit: args.limit,
      nextCursor:
        hasMore && last
          ? this.encodeCursor(last, args.sort, args.direction, cursorContext)
          : null,
    };
  }

  private getCursorContext(
    parentId: string | null | undefined,
    starredOnly: boolean | undefined,
  ): string {
    if (starredOnly) {
      return "starred";
    }

    if (parentId === undefined) {
      return "recent";
    }

    return `folder:${parentId ?? "root"}`;
  }

  private getMongoSort(
    sort: DriveItemSortBy,
    direction: DriveItemSortDirection,
  ): Record<string, 1 | -1> {
    const order = direction === DriveItemSortDirection.ASC ? 1 : -1;
    switch (sort) {
      case DriveItemSortBy.MODIFIED:
        return { lastModifiedAt: order, _id: order };
      case DriveItemSortBy.TYPE:
        return { type: order, normalizedName: 1, _id: 1 };
      case DriveItemSortBy.SIZE:
        return { sizeBytes: order, _id: order };
      case DriveItemSortBy.NAME:
      default:
        return { normalizedName: order, _id: order };
    }
  }

  private buildCursorFilter(
    cursor: string,
    sort: DriveItemSortBy,
    direction: DriveItemSortDirection,
    context: string,
  ): CursorFilter {
    const value = this.decodeCursor(cursor);
    if (
      value.version !== 1 ||
      value.context !== context ||
      value.sort !== sort ||
      value.direction !== direction
    ) {
      throw new BadRequestException("INVALID_CURSOR");
    }

    const id = this.parseObjectId(value.id);
    const operator = direction === DriveItemSortDirection.ASC ? "$gt" : "$lt";
    switch (sort) {
      case DriveItemSortBy.MODIFIED: {
        const lastModifiedAt = this.parseDate(value.lastModifiedAt);
        return {
          $or: [
            { lastModifiedAt: { [operator]: lastModifiedAt } },
            { lastModifiedAt, _id: { [operator]: id } },
          ],
        };
      }
      case DriveItemSortBy.TYPE: {
        const type = this.parseType(value.type);
        const normalizedName = this.parseString(value.normalizedName);
        return {
          $or: [
            { type: { [operator]: type } },
            { type, normalizedName: { $gt: normalizedName } },
            { type, normalizedName, _id: { $gt: id } },
          ],
        };
      }
      case DriveItemSortBy.SIZE:
        return this.buildSizeCursorFilter(
          this.parseSizeBytes(value.sizeBytes),
          id,
          direction,
        );
      case DriveItemSortBy.NAME:
      default: {
        const normalizedName = this.parseString(value.normalizedName);
        return {
          $or: [
            { normalizedName: { [operator]: normalizedName } },
            { normalizedName, _id: { [operator]: id } },
          ],
        };
      }
    }
  }

  private buildSizeCursorFilter(
    sizeBytes: bigint | null,
    id: Types.ObjectId,
    direction: DriveItemSortDirection,
  ): CursorFilter {
    if (sizeBytes === null) {
      return direction === DriveItemSortDirection.ASC
        ? {
            $or: [
              { sizeBytes: null, _id: { $gt: id } },
              { sizeBytes: { $ne: null } },
            ],
          }
        : { sizeBytes: null, _id: { $lt: id } };
    }

    return direction === DriveItemSortDirection.ASC
      ? {
          $or: [
            { sizeBytes: { $gt: sizeBytes } },
            { sizeBytes, _id: { $gt: id } },
          ],
        }
      : {
          $or: [
            { sizeBytes: { $lt: sizeBytes } },
            { sizeBytes, _id: { $lt: id } },
            { sizeBytes: null },
          ],
        };
  }

  private encodeCursor(
    item: CursorItem,
    sort: DriveItemSortBy,
    direction: DriveItemSortDirection,
    context: string,
  ): string {
    const base: EncodedCursor = {
      version: 1,
      context,
      sort,
      direction,
      id: item._id.toString(),
    };

    switch (sort) {
      case DriveItemSortBy.MODIFIED:
        base.lastModifiedAt = item.lastModifiedAt.toISOString();
        break;
      case DriveItemSortBy.TYPE:
        base.type = item.type;
        base.normalizedName = item.normalizedName;
        break;
      case DriveItemSortBy.SIZE:
        base.sizeBytes = item.sizeBytes == null ? null : item.sizeBytes.toString();
        break;
      case DriveItemSortBy.NAME:
      default:
        base.normalizedName = item.normalizedName;
        break;
    }

    return Buffer.from(JSON.stringify(base)).toString("base64url");
  }

  private decodeCursor(cursor: string): EncodedCursor {
    try {
      const value = JSON.parse(
        Buffer.from(cursor, "base64url").toString("utf8"),
      ) as EncodedCursor;
      if (
        !value ||
        typeof value !== "object" ||
        (value.version !== undefined && value.version !== 1)
      ) {
        throw new Error("invalid cursor shape");
      }
      return value;
    } catch {
      throw new BadRequestException("INVALID_CURSOR");
    }
  }

  private parseObjectId(value: unknown): Types.ObjectId {
    if (typeof value !== "string" || !Types.ObjectId.isValid(value)) {
      throw new BadRequestException("INVALID_CURSOR");
    }
    return new Types.ObjectId(value);
  }

  private parseDate(value: unknown): Date {
    if (typeof value !== "string") {
      throw new BadRequestException("INVALID_CURSOR");
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException("INVALID_CURSOR");
    }
    return date;
  }

  private parseType(value: unknown): DriveItemType {
    if (value !== DriveItemType.FILE && value !== DriveItemType.FOLDER) {
      throw new BadRequestException("INVALID_CURSOR");
    }
    return value;
  }

  private parseString(value: unknown): string {
    if (typeof value !== "string") {
      throw new BadRequestException("INVALID_CURSOR");
    }
    return value;
  }

  private parseSizeBytes(value: unknown): bigint | null {
    if (value === null) {
      return null;
    }
    if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value)) {
      throw new BadRequestException("INVALID_CURSOR");
    }
    return BigInt(value);
  }
}
