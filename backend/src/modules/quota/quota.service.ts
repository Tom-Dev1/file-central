
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { QuotaAccount } from './schemas/quota-account.schema';
import { QuotaTransaction, QuotaTxType } from './schemas/quota-transaction.schema';

export class QuotaExceededError extends ForbiddenException {
  constructor() { super('QUOTA_EXCEEDED'); }
}

@Injectable()
export class QuotaService {
  constructor(
    @InjectModel(QuotaAccount.name) private readonly accountModel: Model<QuotaAccount>,
    @InjectModel(QuotaTransaction.name) private readonly txModel: Model<QuotaTransaction>,
  ) { }

  async createAccount(userId: Types.ObjectId, quotaBytes: bigint): Promise<void> {
    await this.accountModel.updateOne(
      { userId },
      { $setOnInsert: { quotaBytes, usedBytes: 0n, reservedBytes: 0n } },
      { upsert: true },
    );
  }

  async reserve(userId: Types.ObjectId, bytes: bigint, key: string): Promise<void> {
    this.assertPositive(bytes);
    if (await this.wasApplied(key)) return;
    const account = await this.accountModel.findOneAndUpdate(
      { userId, $expr: { $lte: [{ $add: ['$usedBytes', '$reservedBytes', bytes] }, '$quotaBytes'] } },
      { $inc: { reservedBytes: bytes } },
      { new: true },
    );
    if (!account) {
      if (!(await this.accountModel.exists({ userId }))) throw new NotFoundException('QUOTA_ACCOUNT_NOT_FOUND');
      throw new QuotaExceededError();
    }
    await this.finishOrRollback(
      () => this.record(userId, QuotaTxType.RESERVE, bytes, key),
      () => this.accountModel.updateOne({ userId, reservedBytes: { $gte: bytes } }, { $inc: { reservedBytes: -bytes } }),
    );
  }

  async commit(
    userId: Types.ObjectId,
    bytes: bigint,
    key: string,
    refs: { uploadSessionId?: Types.ObjectId; driveItemId?: Types.ObjectId } = {},
  ): Promise<void> {
    this.assertPositive(bytes);
    if (await this.wasApplied(key)) return;
    const account = await this.accountModel.findOneAndUpdate(
      { userId, reservedBytes: { $gte: bytes } },
      { $inc: { reservedBytes: -bytes, usedBytes: bytes } },
      { new: true },
    );
    if (!account) throw new ConflictException('QUOTA_COMMIT_INCONSISTENT');
    await this.finishOrRollback(
      () => this.record(userId, QuotaTxType.COMMIT, bytes, key, refs),
      () => this.accountModel.updateOne({ userId, usedBytes: { $gte: bytes } }, { $inc: { reservedBytes: bytes, usedBytes: -bytes } }),
    );
  }

  async release(userId: Types.ObjectId, bytes: bigint, key: string): Promise<void> {
    this.assertPositive(bytes);
    if (await this.wasApplied(key)) return;
    const account = await this.accountModel.findOneAndUpdate(
      { userId, reservedBytes: { $gte: bytes } },
      { $inc: { reservedBytes: -bytes } },
      { new: true },
    );
    if (!account) throw new ConflictException('QUOTA_RELEASE_INCONSISTENT');
    await this.finishOrRollback(
      () => this.record(userId, QuotaTxType.RELEASE, bytes, key),
      () => this.accountModel.updateOne({ userId }, { $inc: { reservedBytes: bytes } }),
    );
  }

  async releaseUsed(userId: Types.ObjectId, bytes: bigint, key: string, driveItemId?: Types.ObjectId): Promise<void> {
    this.assertPositive(bytes);
    if (await this.wasApplied(key)) return;
    const account = await this.accountModel.findOneAndUpdate(
      { userId, usedBytes: { $gte: bytes } },
      { $inc: { usedBytes: -bytes } },
      { new: true },
    );
    if (!account) throw new ConflictException('QUOTA_DELETE_INCONSISTENT');
    await this.finishOrRollback(
      () => this.record(userId, QuotaTxType.DELETE, bytes, key, { driveItemId }),
      () => this.accountModel.updateOne({ userId }, { $inc: { usedBytes: bytes } }),
    );
  }

  private async finishOrRollback(record: () => Promise<void>, rollback: () => Promise<unknown>): Promise<void> {
    try { await record(); }
    catch (error) {
      await rollback();
      if (!this.isDuplicateKey(error)) throw error;
    }
  }

  private async wasApplied(key: string): Promise<boolean> {
    return (await this.txModel.exists({ idempotencyKey: key })) !== null;
  }

  private async record(
    userId: Types.ObjectId,
    type: QuotaTxType,
    bytes: bigint,
    idempotencyKey: string,
    refs: { uploadSessionId?: Types.ObjectId; driveItemId?: Types.ObjectId } = {},
  ): Promise<void> {
    await this.txModel.create({ userId, type, bytes, idempotencyKey, uploadSessionId: refs.uploadSessionId ?? null, driveItemId: refs.driveItemId ?? null });
  }

  private assertPositive(bytes: bigint): void {
    if (bytes <= 0n) throw new ConflictException('QUOTA_BYTES_MUST_BE_POSITIVE');
  }

  private isDuplicateKey(error: unknown): error is { code: number } {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
  }
}
