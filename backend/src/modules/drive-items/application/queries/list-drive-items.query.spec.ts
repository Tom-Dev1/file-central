import { BadRequestException } from "@nestjs/common";
import { Types } from "mongoose";
import {
  DriveItemSortBy,
  DriveItemSortDirection,
  DriveItemType,
} from "../../domain/enums/drive-item.enum";
import { ListDriveItemsQuery } from "./list-drive-items.query";

describe("ListDriveItemsQuery", () => {
  const ownerId = new Types.ObjectId().toString();

  function createQuery(rows: unknown[] = []) {
    const findMany = jest.fn().mockResolvedValue(rows);
    return {
      findMany,
      query: new ListDriveItemsQuery({ findMany } as never),
    };
  }

  function encode(value: Record<string, unknown>) {
    return Buffer.from(JSON.stringify(value)).toString("base64url");
  }

  it.each([
    [DriveItemSortBy.NAME, DriveItemSortDirection.ASC, { normalizedName: 1, _id: 1 }],
    [DriveItemSortBy.NAME, DriveItemSortDirection.DESC, { normalizedName: -1, _id: -1 }],
    [DriveItemSortBy.MODIFIED, DriveItemSortDirection.ASC, { lastModifiedAt: 1, _id: 1 }],
    [DriveItemSortBy.MODIFIED, DriveItemSortDirection.DESC, { lastModifiedAt: -1, _id: -1 }],
    [DriveItemSortBy.TYPE, DriveItemSortDirection.ASC, { type: 1, normalizedName: 1, _id: 1 }],
    [DriveItemSortBy.TYPE, DriveItemSortDirection.DESC, { type: -1, normalizedName: 1, _id: 1 }],
    [DriveItemSortBy.SIZE, DriveItemSortDirection.ASC, { sizeBytes: 1, _id: 1 }],
    [DriveItemSortBy.SIZE, DriveItemSortDirection.DESC, { sizeBytes: -1, _id: -1 }],
  ] as const)("uses the %s/%s database order", async (sort, direction, expected) => {
    const { findMany, query } = createQuery();
    await query.execute({ ownerId, parentId: null, limit: 20, sort, direction });
    expect(findMany.mock.calls[0][1].sort).toEqual(expected);
  });

  it("lists by name ascending without forcing folders first", async () => {
    const folderId = new Types.ObjectId();
    const fileId = new Types.ObjectId();
    const extraId = new Types.ObjectId();
    const { findMany, query } = createQuery([
      {
        _id: folderId,
        type: DriveItemType.FOLDER,
        normalizedName: "alpha",
      },
      {
        _id: fileId,
        type: DriveItemType.FILE,
        normalizedName: "beta.txt",
      },
      {
        _id: extraId,
        type: DriveItemType.FILE,
        normalizedName: "gamma.txt",
      },
    ]);

    const result = await query.execute({
      ownerId,
      parentId: null,
      limit: 2,
      sort: DriveItemSortBy.NAME,
      direction: DriveItemSortDirection.ASC,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ isTrashed: false, parentId: null }),
      {
        select: "+normalizedName",
        sort: { normalizedName: 1, _id: 1 },
        limit: 3,
      },
    );
    expect(result.items).toHaveLength(2);
    expect(JSON.parse(Buffer.from(result.nextCursor!, "base64url").toString("utf8"))).toEqual({
      version: 1,
      sort: DriveItemSortBy.NAME,
      direction: DriveItemSortDirection.ASC,
      id: fileId.toString(),
      normalizedName: "beta.txt",
    });
  });

  it("uses lastModifiedAt and _id as the modified keyset", async () => {
    const itemId = new Types.ObjectId();
    const { findMany, query } = createQuery();

    await query.execute({
      ownerId,
      parentId: null,
      limit: 50,
      sort: DriveItemSortBy.MODIFIED,
      direction: DriveItemSortDirection.DESC,
      cursor: encode({
        version: 1,
        sort: DriveItemSortBy.MODIFIED,
        direction: DriveItemSortDirection.DESC,
        lastModifiedAt: "2026-08-13T10:00:00.000Z",
        id: itemId.toString(),
      }),
    });

    const [filter, options] = findMany.mock.calls[0];
    expect(options).toEqual({
      select: undefined,
      sort: { lastModifiedAt: -1, _id: -1 },
      limit: 51,
    });
    expect(filter.$or[0].lastModifiedAt.$lt).toEqual(new Date("2026-08-13T10:00:00.000Z"));
    expect(filter.$or[1]._id.$lt.toString()).toBe(itemId.toString());
  });

  it("sorts type descending with folders first and stable names", async () => {
    const itemId = new Types.ObjectId();
    const { findMany, query } = createQuery();

    await query.execute({
      ownerId,
      parentId: null,
      limit: 20,
      sort: DriveItemSortBy.TYPE,
      direction: DriveItemSortDirection.DESC,
      cursor: encode({
        version: 1,
        sort: DriveItemSortBy.TYPE,
        direction: DriveItemSortDirection.DESC,
        type: DriveItemType.FILE,
        normalizedName: "readme",
        id: itemId.toString(),
      }),
    });

    const [filter, options] = findMany.mock.calls[0];
    expect(options.sort).toEqual({
      type: -1,
      normalizedName: 1,
      _id: 1,
    });
    expect(filter.$or).toEqual([
      { type: { $lt: DriveItemType.FILE } },
      {
        type: DriveItemType.FILE,
        normalizedName: { $gt: "readme" },
      },
      {
        type: DriveItemType.FILE,
        normalizedName: "readme",
        _id: { $gt: itemId },
      },
    ]);
  });

  it("rejects a cursor created for another sort mode", async () => {
    const { query } = createQuery();
    const cursor = encode({
      version: 1,
      sort: DriveItemSortBy.NAME,
      direction: DriveItemSortDirection.ASC,
      normalizedName: "report.pdf",
      id: new Types.ObjectId().toString(),
    });

    await expect(
      query.execute({
        ownerId,
        parentId: null,
        cursor,
        limit: 50,
        sort: DriveItemSortBy.MODIFIED,
        direction: DriveItemSortDirection.ASC,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("sorts size descending and continues into null folder sizes", async () => {
    const itemId = new Types.ObjectId();
    const { findMany, query } = createQuery();

    await query.execute({
      ownerId,
      parentId: null,
      limit: 20,
      sort: DriveItemSortBy.SIZE,
      direction: DriveItemSortDirection.DESC,
      cursor: encode({
        version: 1,
        sort: DriveItemSortBy.SIZE,
        direction: DriveItemSortDirection.DESC,
        sizeBytes: "1024",
        id: itemId.toString(),
      }),
    });

    const [filter, options] = findMany.mock.calls[0];
    expect(options.sort).toEqual({ sizeBytes: -1, _id: -1 });
    expect(filter.$or).toEqual([
      { sizeBytes: { $lt: 1024n } },
      { sizeBytes: 1024n, _id: { $lt: itemId } },
      { sizeBytes: null },
    ]);
  });
});
