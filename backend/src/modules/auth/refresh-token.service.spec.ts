import { UnauthorizedException } from "@nestjs/common";
import { Types } from "mongoose";

import { RefreshTokenService } from "./refresh-token.service";

describe("RefreshTokenService", () => {
  const createService = () => {
    const refreshTokenModel = {
      create: jest.fn(),
      findOneAndUpdate: jest.fn(),
      updateOne: jest.fn(),
      updateMany: jest.fn(),
    };
    const configService = {
      get: jest.fn().mockReturnValue("30"),
    };

    return {
      refreshTokenModel,
      service: new RefreshTokenService(refreshTokenModel as never, configService as never),
    };
  };

  it("atomically revokes a valid token before rotating it", async () => {
    const { refreshTokenModel, service } = createService();
    const userId = new Types.ObjectId();
    refreshTokenModel.findOneAndUpdate.mockResolvedValue({ userId });
    jest.spyOn(service, "issue").mockResolvedValue("new-refresh-token");

    await expect(service.validateAndRotate("current-refresh-token")).resolves.toEqual({
      userId: userId.toString(),
      newRawToken: "new-refresh-token",
    });
    expect(refreshTokenModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenHash: expect.any(String),
        isRevoked: false,
        expiresAt: { $gt: expect.any(Date) },
      }),
      { $set: { isRevoked: true } },
      { returnDocument: "before" },
    );
    expect(service.issue).toHaveBeenCalledWith(userId.toString());
  });

  it("rejects an expired, revoked, or already-rotated token", async () => {
    const { refreshTokenModel, service } = createService();
    refreshTokenModel.findOneAndUpdate.mockResolvedValue(null);

    await expect(service.validateAndRotate("invalid-refresh-token")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
