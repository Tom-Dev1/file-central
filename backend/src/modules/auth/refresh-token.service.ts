import { Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { createHash } from "crypto";
import { ConfigService } from "@nestjs/config";
import { RefreshToken, RefreshTokenDocument } from "./schemas/refresh-token.schema";
import { generateToken } from "../../common/utils/token.util";

@Injectable()
export class RefreshTokenService {
  private readonly ttlDays: number;

  constructor(
    @InjectModel(RefreshToken.name) private refreshTokenModel: Model<RefreshTokenDocument>,
    private configService: ConfigService
  ) {
    this.ttlDays = parseInt(this.configService.get<string>("REFRESH_TOKEN_EXPIRES_IN_DAYS") || "30", 10);
  }

  private hash(rawToken: string): string {
    return createHash("sha256").update(rawToken).digest("hex");
  }

  /** Issues a new refresh token for a user and returns the RAW value (only ever seen once). */
  async issue(userId: string): Promise<string> {
    const rawToken = generateToken(32);
    const expiresAt = new Date(Date.now() + this.ttlDays * 24 * 60 * 60 * 1000);

    await this.refreshTokenModel.create({
      userId: new Types.ObjectId(userId),
      tokenHash: this.hash(rawToken),
      expiresAt,
      isRevoked: false,
    });

    return rawToken;
  }

  /**
   * Validates a raw refresh token and, if valid, rotates it: the old one
   * is revoked and a brand new one is issued. Rotation limits the damage
   * if a refresh token is ever stolen (old one becomes useless).
   */
  async validateAndRotate(rawToken: string): Promise<{ userId: string; newRawToken: string }> {
    const tokenHash = this.hash(rawToken);
    const record = await this.refreshTokenModel.findOne({ tokenHash });

    if (!record || record.isRevoked || record.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    record.isRevoked = true;
    await record.save();

    const newRawToken = await this.issue(record.userId.toString());
    return { userId: record.userId.toString(), newRawToken };
  }

  async revoke(rawToken: string): Promise<void> {
    const tokenHash = this.hash(rawToken);
    await this.refreshTokenModel.updateOne({ tokenHash }, { isRevoked: true });
  }

  /** Revokes every refresh token for a user  */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.refreshTokenModel.updateMany(
      { userId: new Types.ObjectId(userId), isRevoked: false },
      { isRevoked: true }
    );
  }
}
