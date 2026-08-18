import { Types } from "mongoose";
import { DriveItemNamePolicy } from "../../../domain/policies/drive-item-name.policy";
import { CreateFolderCommand } from "./create-folder.command";

describe("CreateFolderCommand", () => {
  it("generates another available name after a concurrent duplicate", async () => {
    const ownerId = new Types.ObjectId();
    const createdFolder = { _id: new Types.ObjectId(), name: "Reports (1)" };
    const create = jest
      .fn()
      .mockRejectedValueOnce({ code: 11000 })
      .mockResolvedValueOnce(createdFolder);
    const resolveAncestors = jest.fn().mockResolvedValue([]);
    const adjust = jest.fn().mockResolvedValue(undefined);
    const generateAvailableName = jest
      .fn()
      .mockResolvedValueOnce("Reports")
      .mockResolvedValueOnce("Reports (1)");
    const command = new CreateFolderCommand(
      { model: { create } } as never,
      new DriveItemNamePolicy(),
      { resolveAncestors } as never,
      { adjust } as never,
      { generateAvailableName } as never,
    );

    await expect(command.execute({ ownerId, parentId: null, name: "Reports" })).resolves.toBe(
      createdFolder,
    );
    expect(generateAvailableName).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: "Reports (1)", normalizedName: "reports (1)" }),
    );
    expect(adjust).toHaveBeenCalledWith(null, 1);
  });
});
