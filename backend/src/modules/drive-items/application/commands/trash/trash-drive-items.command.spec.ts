import { ConflictException } from "@nestjs/common";
import { Types } from "mongoose";

import { MAX_SYNC_SUBTREE_ITEMS } from "../../../domain/constants/drive-item.constants";
import { TrashDriveItemsCommand } from "./trash-drive-items.command";

function findResult<T>(result: T) {
  return {
    select: jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(result) }),
      lean: jest.fn().mockResolvedValue(result),
    }),
  };
}

describe("TrashDriveItemsCommand", () => {
  it("collapses a selected descendant into its selected ancestor root", async () => {
    const ownerId = new Types.ObjectId();
    const parentId = new Types.ObjectId();
    const rootId = new Types.ObjectId();
    const childId = new Types.ObjectId();
    const grandchildId = new Types.ObjectId();
    const root = { _id: rootId, ownerId, parentId, ancestorIds: [parentId] };
    const child = { _id: childId, ownerId, parentId: rootId, ancestorIds: [parentId, rootId] };
    const model = {
      find: jest
        .fn()
        .mockReturnValueOnce(findResult([root, child]))
        .mockReturnValueOnce(findResult([
          { _id: childId, ancestorIds: [parentId, rootId] },
          { _id: grandchildId, ancestorIds: [parentId, rootId, childId] },
        ])),
      findOneAndUpdate: jest.fn().mockResolvedValue(root),
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 2 }),
    };
    const childCounts = { adjust: jest.fn().mockResolvedValue(undefined) };
    const command = new TrashDriveItemsCommand({ model } as never, childCounts as never);

    await expect(command.execute([rootId, childId])).resolves.toEqual([rootId, childId, grandchildId]);
    expect(model.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(model.updateMany).toHaveBeenCalledWith(
      { _id: { $in: [childId, grandchildId] }, isTrashed: false },
      expect.objectContaining({ $set: expect.objectContaining({ trashedRootId: rootId }) }),
    );
    expect(childCounts.adjust).toHaveBeenCalledWith(parentId, -1);
  });

  it("rejects an oversized combined subtree before claiming roots", async () => {
    const rootId = new Types.ObjectId();
    const root = { _id: rootId, ownerId: new Types.ObjectId(), parentId: null, ancestorIds: [] };
    const descendants = Array.from({ length: MAX_SYNC_SUBTREE_ITEMS }, () => ({
      _id: new Types.ObjectId(),
      ancestorIds: [rootId],
    }));
    const model = {
      find: jest
        .fn()
        .mockReturnValueOnce(findResult([root]))
        .mockReturnValueOnce(findResult(descendants)),
      findOneAndUpdate: jest.fn(),
      updateMany: jest.fn(),
    };
    const command = new TrashDriveItemsCommand({ model } as never, { adjust: jest.fn() } as never);

    await expect(command.execute([rootId])).rejects.toBeInstanceOf(ConflictException);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
    expect(model.updateMany).not.toHaveBeenCalled();
  });
});
