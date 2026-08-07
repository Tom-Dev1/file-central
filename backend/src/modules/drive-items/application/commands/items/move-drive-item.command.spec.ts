import { ConflictException } from "@nestjs/common";
import { Types } from "mongoose";
import { DriveItemType } from "../../../domain/enums/drive-item.enum";
import { DriveItemNamePolicy } from "../../../domain/policies/drive-item-name.policy";
import { MoveDriveItemCommand } from "./move-drive-item.command";

describe("MoveDriveItemCommand", () => {
  it("maps a unique-index race to NAME_ALREADY_EXISTS", async () => {
    const itemId = new Types.ObjectId();
    const ownerId = new Types.ObjectId();
    const model = {
      findOne: jest.fn().mockResolvedValue({
        _id: itemId,
        ownerId,
        parentId: null,
        ancestorIds: [],
        name: "report.txt",
        type: DriveItemType.FILE,
      }),
      findOneAndUpdate: jest.fn().mockRejectedValue({ code: 11000 }),
    };
    const command = new MoveDriveItemCommand(
      { model } as never,
      new DriveItemNamePolicy(),
      { assertAvailable: jest.fn() } as never,
      { resolveAncestors: jest.fn().mockResolvedValue([]) } as never,
      { adjust: jest.fn() } as never,
    );

    await expect(command.execute({
      ownerId,
      itemId,
      newParentId: new Types.ObjectId(),
      expectedMetadataVersion: 1,
    })).rejects.toMatchObject<Partial<ConflictException>>({ message: "NAME_ALREADY_EXISTS" });
  });
});
