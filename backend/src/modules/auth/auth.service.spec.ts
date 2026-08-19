import { UnauthorizedException } from "@nestjs/common";
import { Types } from "mongoose";

import { AuthService } from "./auth.service";

describe("AuthService", () => {
  const createService = () => {
    const usersService = {
      findById: jest.fn(),
    };
    const jwtService = {
      sign: jest.fn().mockReturnValue("access-token"),
    };
    const refreshTokenService = {
      validateAndRotate: jest.fn(),
      revoke: jest.fn(),
      revokeAllForUser: jest.fn(),
    };

    return {
      usersService,
      jwtService,
      refreshTokenService,
      service: new AuthService(
        usersService as never,
        jwtService as never,
        refreshTokenService as never,
      ),
    };
  };

  it("returns a rotated refresh token and a new access token", async () => {
    const { usersService, jwtService, refreshTokenService, service } = createService();
    const userId = new Types.ObjectId();
    refreshTokenService.validateAndRotate.mockResolvedValue({
      userId: userId.toString(),
      newRawToken: "rotated-refresh-token",
    });
    usersService.findById.mockResolvedValue({ _id: userId, email: "user@example.com" });

    await expect(service.refresh("current-refresh-token")).resolves.toEqual({
      accessToken: "access-token",
      refreshToken: "rotated-refresh-token",
    });
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: userId.toString(),
      email: "user@example.com",
    });
  });

  it("rejects refresh when the user no longer exists", async () => {
    const { usersService, refreshTokenService, service } = createService();
    refreshTokenService.validateAndRotate.mockResolvedValue({
      userId: new Types.ObjectId().toString(),
      newRawToken: "rotated-refresh-token",
    });
    usersService.findById.mockResolvedValue(null);

    await expect(service.refresh("current-refresh-token")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("revokes one session or every session", async () => {
    const { refreshTokenService, service } = createService();

    await expect(service.logout("refresh-token")).resolves.toEqual({ loggedOut: true });
    await expect(service.logoutAll("user-id")).resolves.toEqual({ loggedOutAllDevices: true });
    expect(refreshTokenService.revoke).toHaveBeenCalledWith("refresh-token");
    expect(refreshTokenService.revokeAllForUser).toHaveBeenCalledWith("user-id");
  });
});
