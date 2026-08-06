import { ConflictException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import * as bcrypt from "bcrypt";
import { User, UserDocument } from "./schemas/user.schema";

import { QuotaService } from "../quota/quota.service";

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly quotaService: QuotaService
  ) {}
  async create(email: string, name: string, password: string, username: string): Promise<UserDocument> {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();

    const existingUser = await this.userModel
      .findOne({
        $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
      })
      .select({
        email: 1,
        username: 1,
      })
      .lean()
      .exec();

    if (existingUser) {
      if (existingUser.email === normalizedEmail) {
        throw new ConflictException("Email already registered");
      }

      if (existingUser.username === normalizedUsername) {
        throw new ConflictException("Username already registered");
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    try {
      const user = await this.userModel.create({
        email: normalizedEmail,
        username: normalizedUsername,
        name: name.trim(),
        passwordHash,
      });

      try {
        const defaultQuotaBytes = BigInt(process.env.DEFAULT_QUOTA_BYTES ?? "107374182400");
        await this.quotaService.createAccount(user._id, defaultQuotaBytes);
      } catch (error) {
        await this.userModel.deleteOne({ _id: user._id });
        throw error;
      }
      return user;
    } catch (error: unknown) {
      if (this.isDuplicateKeyError(error)) {
        if (error.keyPattern?.email) {
          throw new ConflictException("Email already registered");
        }

        if (error.keyPattern?.username) {
          throw new ConflictException("Username already registered");
        }

        throw new ConflictException("Email or username already registered");
      }

      throw error;
    }
  }

  private isDuplicateKeyError(error: unknown): error is {
    code: number;
    keyPattern?: {
      email?: number;
      username?: number;
    };
  } {
    return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() });
  }
  async fintByUserName(username: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ username: username.toLowerCase() });
  }
  async findById(id: string | Types.ObjectId): Promise<UserDocument | null> {
    return this.userModel.findById(id);
  }

  async validatePassword(user: UserDocument, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }
}
