import { ConflictException } from "@nestjs/common";
import { Types } from "mongoose";

import { DriveItemNamePolicy } from "../../../domain/policies/drive-item-name.policy";
import { MoveDriveItemsCommand } from "./move-drive-items.command";

function createFindChain(items: unknown[]) {
  return {
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(items),
      }),
    }),
  };
}

describe("MoveDriveItemsCommand", () => {
  it("moves only the selected root when its descendant is also selected", async () => {
    const ownerId = new Types.ObjectId();
    const rootId = new Types.ObjectId();
    const childId = new Types.ObjectId();
    const destinationId = new Types.ObjectId();
    const model = createFindChain([
      {
        _id: rootId,
        ownerId,
        parentId: null,
        ancestorIds: [],
        name: "Projects",
        metadataVersion: 2,
      },
      {
        _id: childId,
        ownerId,
        parentId: rootId,
        ancestorIds: [rootId],
        name: "Report.pdf",
        metadataVersion: 5,
      },
    ]);
    const availability = { assertAvailable: jest.fn().mockResolvedValue(undefined) };
    const parents = { resolveAncestors: jest.fn().mockResolvedValue([]) };
    const moveItem = {
      execute: jest.fn().mockResolvedValue({ _id: rootId }),
    };
    const command = new MoveDriveItemsCommand(
      { model } as never,
      new DriveItemNamePolicy(),
      availability as never,
      parents as never,
      moveItem as never,
    );

    await expect(
      command.execute({
        items: [
          { itemId: rootId, expectedMetadataVersion: 2 },
          { itemId: childId, expectedMetadataVersion: 5 },
        ],
        newParentId: destinationId,
      }),
    ).resolves.toEqual([rootId]);

    expect(availability.assertAvailable).toHaveBeenCalledTimes(1);
    expect(moveItem.execute).toHaveBeenCalledTimes(1);
    expect(moveItem.execute).toHaveBeenCalledWith({
      ownerId,
      itemId: rootId,
      newParentId: destinationId,
      expectedMetadataVersion: 2,
    });
  });

  it("rejects duplicate destination names before moving anything", async () => {
    const ownerId = new Types.ObjectId();
    const firstId = new Types.ObjectId();
    const secondId = new Types.ObjectId();
    const destinationId = new Types.ObjectId();
    const model = createFindChain([
      {
        _id: firstId,
        ownerId,
        parentId: new Types.ObjectId(),
        ancestorIds: [],
        name: "Report",
        metadataVersion: 1,
      },
      {
        _id: secondId,
        ownerId,
        parentId: new Types.ObjectId(),
        ancestorIds: [],
        name: " report ",
        metadataVersion: 3,
      },
    ]);
    const availability = { assertAvailable: jest.fn() };
    const moveItem = { execute: jest.fn() };
    const command = new MoveDriveItemsCommand(
      { model } as never,
      new DriveItemNamePolicy(),
      availability as never,
      { resolveAncestors: jest.fn().mockResolvedValue([]) } as never,
      moveItem as never,
    );

    await expect(
      command.execute({
        items: [
          { itemId: firstId, expectedMetadataVersion: 1 },
          { itemId: secondId, expectedMetadataVersion: 3 },
        ],
        newParentId: destinationId,
      }),
    ).rejects.toMatchObject<Partial<ConflictException>>({ message: "NAME_ALREADY_EXISTS" });

    expect(availability.assertAvailable).not.toHaveBeenCalled();
    expect(moveItem.execute).not.toHaveBeenCalled();
  });
});
