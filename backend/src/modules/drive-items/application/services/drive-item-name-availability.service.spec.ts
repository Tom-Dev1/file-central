import { Types } from "mongoose";
import { DriveItemNamePolicy } from "../../domain/policies/drive-item-name.policy";
import { DriveItemNameAvailabilityService } from "./drive-item-name-availability.service";

describe("DriveItemNameAvailabilityService", () => {
  it("adds an incrementing suffix until a folder name is available", async () => {
    const ownerId = new Types.ObjectId();
    const exists = jest
      .fn()
      .mockResolvedValueOnce({ _id: new Types.ObjectId() })
      .mockResolvedValueOnce({ _id: new Types.ObjectId() })
      .mockResolvedValueOnce(null);
    const service = new DriveItemNameAvailabilityService(
      { model: { exists } } as never,
      new DriveItemNamePolicy(),
    );

    await expect(service.generateAvailableName(ownerId, null, "Reports")).resolves.toBe(
      "Reports (2)",
    );
    expect(exists).toHaveBeenNthCalledWith(1, {
      ownerId,
      parentId: null,
      normalizedName: "reports",
      isTrashed: false,
    });
    expect(exists).toHaveBeenNthCalledWith(2, {
      ownerId,
      parentId: null,
      normalizedName: "reports (1)",
      isTrashed: false,
    });
  });
});
