import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  LoggerService,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { HydratedDocument, Model, Types } from "mongoose";

import { UploadSession, UploadMethod, UploadStatus } from "./schemas/upload-session.schema";
import { UploadPart } from "./schemas/upload-part.schema";
import {
  InitUploadDto,
  CompleteUploadDto,
  SINGLE_PART_MAX_BYTES,
  MIN_PART_SIZE_BYTES,
  MAX_PARTS_ALLOWED,
} from "./dto/upload.dto";

import { StorageProvider, StorageScanStatus } from "../storage/enums/storage-object.enum";
import { DriveItemsService } from "../drive-items/drive-items.service";
import { QuotaService } from "../quota/quota.service";
import { S3StorageAdapter } from "../s3/s3-storage.adapter";
import { StorageObjectsService } from "../storage/storage-objects.services";
import { MimeDetectorService } from "../storage/mime-detector.service";

// Document Ä‘Ã£ hydrate má»›i cÃ³ .save()/.set(). DÃ¹ng type nÃ y cho cÃ¡c biáº¿n/param
// cáº§n gá»i save(), thay vÃ¬ type schema-class thuáº§n (khÃ´ng cÃ³ .save()).
type UploadSessionDocument = HydratedDocument<UploadSession>;

/**
 * Äiá»u phá»‘i vÃ²ng Ä‘á»i upload. Byte Ä‘i THáº²NG lÃªn MinIO qua presigned URL;
 * service chá»‰ quáº£n lÃ½ metadata (session, quota, drive item, storage object).
 *
 * 4 endpoint: init / status / complete / abort  + reaper cron (dá»n session treo).
 */
@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly sessionTtlMs = 24 * 60 * 60 * 1000; // 24h

  constructor(
    @InjectModel(UploadSession.name)
    private readonly sessionModel: Model<UploadSession>,
    @InjectModel(UploadPart.name)
    private readonly partModel: Model<UploadPart>,
    private readonly storage: S3StorageAdapter,
    private readonly storageObjects: StorageObjectsService,
    private readonly mimeDetector: MimeDetectorService,
    private readonly driveItems: DriveItemsService,
    private readonly quota: QuotaService
  ) {}

  private get bucketName(): string {
    return this.storage.getBucketName();
  }

  // 1. INIT â€” quyáº¿t single vs multipart, reserve quota, táº¡o placeholder
  async initUpload(ownerId: Types.ObjectId, dto: InitUploadDto) {
    const declaredSizeBytes = BigInt(dto.declaredSizeBytes);
    if (declaredSizeBytes <= 0n) {
      throw new BadRequestException("declaredSizeBytes must be positive");
    }

    // Idempotency: retry cÃ¹ng key -> tráº£ láº¡i session Ä‘Ã£ cÃ³, khÃ´ng táº¡o má»›i.
    const existing = await this.sessionModel.findOne({
      ownerId,
      idempotencyKey: dto.idempotencyKey,
    });
    if (existing) {
      return this.buildInitResponse(existing);
    }

    // 1a. Reserve quota trÆ°á»›c (atomic, fail-fast náº¿u vÆ°á»£t háº¡n má»©c).
    await this.quota.reserve(ownerId, declaredSizeBytes, `${dto.idempotencyKey}:reserve`);

    // 1b. Táº¡o file placeholder. Náº¿u lá»—i (vd trÃ¹ng tÃªn) -> rollback quota.
    let driveItemId: Types.ObjectId;
    try {
      const placeholder = await this.driveItems.createPlaceholder({
        ownerId,
        parentId: dto.parentId ? new Types.ObjectId(dto.parentId) : null,
        name: dto.name,
      });
      driveItemId = placeholder.id;
    } catch (err) {
      await this.quota.release(ownerId, declaredSizeBytes, `${dto.idempotencyKey}:placeholder-rollback`);
      throw err;
    }

    const sessionId = new Types.ObjectId();
    const objectKey = this.storage.buildObjectKey(ownerId.toHexString(), sessionId.toHexString());

    const useMultipart = declaredSizeBytes > BigInt(SINGLE_PART_MAX_BYTES);
    let providerUploadId: string | null = null;
    let partSizeBytes: number | null = null;
    let expectedPartsCount: number | null = null;

    if (useMultipart) {
      partSizeBytes = this.computePartSize(declaredSizeBytes);
      expectedPartsCount = Number((declaredSizeBytes + BigInt(partSizeBytes) - 1n) / BigInt(partSizeBytes));
      providerUploadId = await this.storage.createMultipartUpload(objectKey, dto.mimeTypeHint);
    }

    const session = await this.sessionModel.create({
      _id: sessionId,
      ownerId,
      driveItemId,
      parentId: dto.parentId ? new Types.ObjectId(dto.parentId) : null,
      originalName: dto.name,
      method: useMultipart ? UploadMethod.MULTIPART : UploadMethod.SINGLE,
      providerUploadId,
      temporaryObjectKey: objectKey,
      partSizeBytes,
      expectedPartsCount,
      declaredSizeBytes,
      declaredChecksumSha256: dto.declaredChecksumSha256Hex ? Buffer.from(dto.declaredChecksumSha256Hex, "hex") : null,
      status: UploadStatus.PENDING,
      idempotencyKey: dto.idempotencyKey,
      expiresAt: new Date(Date.now() + this.sessionTtlMs),
    });
    this.logger.log(`INIT session=${session._id} owner=${ownerId}`);

    // Pre-create part placeholder Ä‘á»ƒ client biáº¿t cáº§n upload bao nhiÃªu part.
    if (useMultipart && expectedPartsCount) {
      const partDocs = Array.from({ length: expectedPartsCount }, (_, i) => ({
        uploadSessionId: sessionId,
        partNumber: i + 1,
        etag: null,
        sizeBytes: null,
      }));
      await this.partModel.insertMany(partDocs, { ordered: false });
    }

    return this.buildInitResponse(session);
  }

  // Part size Ä‘á»™ng: giá»¯ sá»‘ part <= MAX_PARTS_ALLOWED dÃ¹ file cá»¡ hÃ ng trÄƒm GB.
  private computePartSize(totalBytes: bigint): number {
    const computed = Number((totalBytes + BigInt(MAX_PARTS_ALLOWED) - 1n) / BigInt(MAX_PARTS_ALLOWED));
    return Math.max(MIN_PART_SIZE_BYTES, computed);
  }

  private async buildInitResponse(session: UploadSessionDocument) {
    if (session.method === UploadMethod.SINGLE) {
      const putUrl = await this.storage.getPresignedPutUrl(session.temporaryObjectKey);
      return {
        uploadSessionId: session._id.toString(),
        method: session.method,
        putUrl,
        expiresAt: session.expiresAt,
      };
    }

    // Multipart: presigned URL cho tá»«ng part CÃ’N THIáº¾U (resume-friendly).
    const missingParts = await this.partModel
      .find({ uploadSessionId: session._id, etag: null })
      .sort({ partNumber: 1 })
      .lean();

    const partUrls = await Promise.all(
      missingParts.map(async (p) => ({
        partNumber: p.partNumber,
        url: await this.storage.getPresignedPartUrl(
          session.temporaryObjectKey,
          session.providerUploadId!,
          p.partNumber
        ),
      }))
    );

    return {
      uploadSessionId: session._id.toString(),
      method: session.method,
      partSizeBytes: session.partSizeBytes,
      expectedPartsCount: session.expectedPartsCount,
      partUrls,
      expiresAt: session.expiresAt,
    };
  }

  // ===================================================================
  // 2. STATUS â€” resume sau máº¥t máº¡ng. Nguá»“n sá»± tháº­t = ListParts cá»§a MinIO.
  // ===================================================================
  async getStatus(ownerId: Types.ObjectId, sessionId: Types.ObjectId) {
    const session = await this.sessionModel.findOne({ _id: sessionId, ownerId });
    if (!session) throw new NotFoundException("UPLOAD_SESSION_NOT_FOUND");

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new ConflictException("UPLOAD_SESSION_EXPIRED");
    }

    if (session.status === UploadStatus.COMPLETED) {
      return { status: session.status, driveItemId: session.driveItemId };
    }
    if (session.status === UploadStatus.PAUSED) {
      session.status = UploadStatus.PENDING;
      await session.save();
    }
    // Aborted and failed sessions no longer have a valid temporary upload on
    // MinIO. Returning a domain conflict prevents ListParts from surfacing a
    // provider NoSuchUpload error as HTTP 500.
    if ([UploadStatus.ABORTED, UploadStatus.EXPIRED, UploadStatus.FAILED].includes(session.status)) {
      throw new ConflictException(`UPLOAD_SESSION_NOT_RESUMABLE:${session.status}`);
    }

    if (session.method === UploadMethod.SINGLE) {
      const head = await this.storage.headObject(session.temporaryObjectKey);
      return { status: session.status, singlePartUploaded: head !== null };
    }

    // Äá»‘i chiáº¿u local upload_parts vá»›i thá»±c táº¿ trÃªn provider.
    const remoteParts = await this.storage.listParts(session.temporaryObjectKey, session.providerUploadId!);
    const remoteByNumber = new Map(remoteParts.map((p) => [p.partNumber, p]));

    if (remoteParts.length > 0) {
      await this.partModel.bulkWrite(
        remoteParts.map((rp) => ({
          updateOne: {
            filter: { uploadSessionId: session._id, partNumber: rp.partNumber },
            update: { $set: { etag: rp.etag, sizeBytes: BigInt(rp.sizeBytes) } },
          },
        })),
        { ordered: false }
      );
    }

    const allParts = await this.partModel.find({ uploadSessionId: session._id }).sort({ partNumber: 1 }).lean();

    const missingPartNumbers = allParts.filter((p) => !remoteByNumber.has(p.partNumber)).map((p) => p.partNumber);

    let missingPartUrls: { partNumber: number; url: string }[] = [];
    if (missingPartNumbers.length > 0) {
      missingPartUrls = await Promise.all(
        missingPartNumbers.map(async (pn) => ({
          partNumber: pn,
          url: await this.storage.getPresignedPartUrl(session.temporaryObjectKey, session.providerUploadId!, pn),
        }))
      );
    }

    return {
      status: session.status,
      totalParts: allParts.length,
      uploadedPartCount: remoteParts.length,
      // uploadedParts: cáº§n cho Uppy listParts (resume chuáº©n).
      uploadedParts: remoteParts
        .map((p) => ({ partNumber: p.partNumber, etag: p.etag, sizeBytes: String(p.sizeBytes) }))
        .sort((a, b) => a.partNumber - b.partNumber),
      missingPartUrls,
    };
  }

  // ===================================================================
  // 3. COMPLETE â€” verify -> táº¡o storage object -> activate -> commit quota
  // ===================================================================
  async completeUpload(ownerId: Types.ObjectId, sessionId: Types.ObjectId, dto: CompleteUploadDto) {
    this.logger.log(`COMPLETE lookup session=${sessionId} owner=${ownerId}`);
    const session = await this.sessionModel.findOne({ _id: sessionId, ownerId });

    if (!session) throw new NotFoundException("UPLOAD_SESSION_NOT_FOUND");

    if (session.status === UploadStatus.COMPLETED) {
      // Idempotent retry.
      return { driveItemId: session.driveItemId, status: session.status };
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      throw new ConflictException("UPLOAD_SESSION_EXPIRED");
    }
    if (session.status !== UploadStatus.PENDING && session.status !== UploadStatus.UPLOADED && session.status !== UploadStatus.PAUSED) {
      throw new ConflictException(`Cannot complete session in status ${session.status}`);
    }

    session.status = UploadStatus.PROCESSING;
    await session.save();

    let createdStorageObjectId: Types.ObjectId | null = null;
    let quotaCommitted = false;

    try {
      const finalSizeBytes = await this.finalizeObjectAndGetSize(session, dto);

      // Verify size khá»›p khai bÃ¡o.
      const declared = BigInt(session.declaredSizeBytes as unknown as string);
      if (finalSizeBytes !== declared) {
        throw new BadRequestException(`Size mismatch: declared ${declared}, actual ${finalSizeBytes}`);
      }

      // Detect MIME/extension tá»« ~4KB Ä‘áº§u object (ráº», khÃ´ng táº£i cáº£ file GB).
      const head = await this.storage.getObjectRange(session.temporaryObjectKey, 0, 4100);
      const { mimeType, extension } = await this.mimeDetector.detect(head, session.originalName ?? "upload");

      // checksum: KHÃ”NG hash cáº£ file GB Ä‘á»“ng bá»™ (phÃ¡ vá»¡ kiáº¿n trÃºc byte-khÃ´ng-qua-server).
      // Baseline: dÃ¹ng checksum client khai bÃ¡o náº¿u cÃ³ (Ä‘Ã£ ghi á»Ÿ session), else null.
      // [Báº N HOÃ€N THIá»†N]: náº¿u cáº§n verify chuáº©n -> worker async Ä‘á»c object + hash,
      // hoáº·c báº­t MinIO server-side checksum (x-amz-checksum-sha256).
      const checksumSha256: Buffer | null = session.declaredChecksumSha256;

      const storageObject = await this.storageObjects.create({
        ownerId,
        bucket: this.bucketName,
        objectKey: session.temporaryObjectKey,
        sizeBytes: finalSizeBytes,
        mimeType,
        checksumSha256,
        provider: StorageProvider.MINIO,
        scanStatus: StorageScanStatus.NOT_REQUESTED,
      });
      createdStorageObjectId = storageObject.id;

      await this.driveItems.activateFile({
        driveItemId: session.driveItemId,
        storageObjectId: storageObject.id,
        mimeType,
        sizeBytes: finalSizeBytes,
        extension,
      });

      // Commit quota (reserved -> used).
      await this.quota.commit(ownerId, finalSizeBytes, `${session.idempotencyKey ?? session._id.toString()}:commit`, {
        uploadSessionId: session._id,
        driveItemId: session.driveItemId,
      });
      quotaCommitted = true;

      // Tráº£ láº¡i pháº§n reserved dÆ° náº¿u size thá»±c < khai bÃ¡o.
      const reservedExtra = declared - finalSizeBytes;
      if (reservedExtra > 0n) {
        await this.quota.release(ownerId, reservedExtra, `${session.idempotencyKey ?? session._id.toString()}:adjust`);
      }

      session.status = UploadStatus.COMPLETED;
      session.actualSizeBytes = finalSizeBytes as any;
      await session.save();

      return { driveItemId: session.driveItemId, status: session.status };
    } catch (err) {
      await this.rollbackFailedCompletion(session, ownerId, createdStorageObjectId, quotaCommitted, err);
      throw err;
    }
  }

  /**
   * HoÃ n táº¥t object trÃªn MinIO vÃ  tráº£ vá» size tháº­t.
   * Multipart: verify Ä‘á»§ & Ä‘Ãºng thá»© tá»± part -> CompleteMultipartUpload.
   * Single: HeadObject.
   */
  private async finalizeObjectAndGetSize(session: UploadSessionDocument, dto: CompleteUploadDto): Promise<bigint> {
    if (session.method !== UploadMethod.MULTIPART) {
      const head = await this.storage.headObject(session.temporaryObjectKey);
      if (!head) throw new BadRequestException("Object not found on storage â€” upload incomplete");
      return BigInt(head.sizeBytes);
    }

    const remoteParts = await this.storage.listParts(session.temporaryObjectKey, session.providerUploadId!);
    const expected = session.expectedPartsCount ?? 0;
    if (remoteParts.length !== expected) {
      throw new BadRequestException(`Expected ${expected} parts, uploaded ${remoteParts.length}`);
    }

    // Part number pháº£i liÃªn tá»¥c 1..expected.
    const numbers = remoteParts.map((p) => p.partNumber).sort((a, b) => a - b);
    if (numbers.some((n, i) => n !== i + 1)) {
      throw new BadRequestException("Multipart upload has missing/invalid part numbers");
    }

    // Náº¿u client gá»­i manifest -> Ä‘á»‘i chiáº¿u etag & size Ä‘á»ƒ chá»‘ng nháº§m láº«n.
    if (dto.parts?.length) {
      const submitted = new Map<number, { partNumber: number; etag: string; sizeBytes: string }>(
        dto.parts.map((p) => [p.partNumber, p])
      );
      const mismatch = remoteParts.some((remote) => {
        const p = submitted.get(remote.partNumber);
        return (
          !p ||
          this.normalizeEtag(p.etag) !== this.normalizeEtag(remote.etag) ||
          BigInt(p.sizeBytes) !== BigInt(remote.sizeBytes)
        );
      });
      if (submitted.size !== expected || mismatch) {
        throw new BadRequestException("Submitted multipart manifest does not match object storage");
      }
    }

    await this.storage.completeMultipartUpload(session.temporaryObjectKey, session.providerUploadId!, remoteParts);
    return remoteParts.reduce((sum, p) => sum + BigInt(p.sizeBytes), 0n);
  }

  /** Dá»n dáº¹p khi complete tháº¥t báº¡i: mark failed + xoÃ¡ object/storage + release quota. */
  private async rollbackFailedCompletion(
    session: UploadSessionDocument,
    ownerId: Types.ObjectId,
    createdStorageObjectId: Types.ObjectId | null,
    quotaCommitted: boolean,
    err: unknown
  ): Promise<void> {
    session.status = UploadStatus.FAILED;
    session.errorCode = err instanceof Error ? err.message : "UNKNOWN_ERROR";
    await session.save();

    await this.driveItems.markFailed(session.driveItemId).catch(() => undefined);

    // Náº¿u chÆ°a commit quota -> coi nhÆ° upload chÆ°a thÃ nh cÃ´ng, dá»n sáº¡ch.
    if (!quotaCommitted) {
      if (session.method === UploadMethod.MULTIPART && session.providerUploadId) {
        await this.storage
          .abortMultipartUpload(session.temporaryObjectKey, session.providerUploadId)
          .catch(() => undefined);
      }
      await this.storage.deleteObject(session.temporaryObjectKey).catch(() => undefined);
      if (createdStorageObjectId) {
        await this.storageObjects.permanentDelete(createdStorageObjectId).catch(() => undefined);
      }
      await this.quota
        .release(
          ownerId,
          BigInt(session.declaredSizeBytes as unknown as string),
          `${session.idempotencyKey ?? session._id.toString()}:failure-release`
        )
        .catch(() => undefined);
    }
    this.logger.error(`Complete failed for session ${session._id}: ${session.errorCode}`);
  }

  private normalizeEtag(etag: string): string {
    return etag.trim().replace(/"/g, "");
  }

  // ===================================================================
  // 4. PAUSE — the client-facing abort action preserves MinIO parts and
  // quota so the same upload session can be resumed later.
  // ===================================================================
  async abortUpload(ownerId: Types.ObjectId, sessionId: Types.ObjectId) {
    const session = await this.sessionModel.findOne({ _id: sessionId, ownerId });
    if (!session) throw new NotFoundException("UPLOAD_SESSION_NOT_FOUND");
    if (session.status === UploadStatus.COMPLETED) {
      throw new ConflictException("Cannot pause a completed upload");
    }
    if ([UploadStatus.ABORTED, UploadStatus.EXPIRED, UploadStatus.FAILED].includes(session.status)) {
      return { status: session.status };
    }
    if (session.status === UploadStatus.PAUSED) {
      return { status: session.status };
    }

    session.status = UploadStatus.PAUSED;
    await session.save();
    return { status: session.status };
  }

  // ===================================================================
  // 5. REAPER â€” cron dá»n session háº¿t háº¡n (client crash/máº¥t máº¡ng vÄ©nh viá»…n).
  // ===================================================================
  async reapExpiredSessions(batchSize = 100): Promise<number> {
    const now = new Date();
    const expired = await this.sessionModel
      .find({
        status: { $in: [UploadStatus.PENDING, UploadStatus.PAUSED, UploadStatus.UPLOADED, UploadStatus.PROCESSING] },
        expiresAt: { $lt: now },
      })
      .limit(batchSize)
      .lean();

    let reaped = 0;
    for (const s of expired) {
      try {
        if (s.method === UploadMethod.MULTIPART && s.providerUploadId) {
          await this.storage.abortMultipartUpload(s.temporaryObjectKey, s.providerUploadId);
        } else {
          await this.storage.deleteObject(s.temporaryObjectKey).catch(() => undefined);
        }
        await this.quota.release(
          s.ownerId,
          BigInt(s.declaredSizeBytes as unknown as string),
          `${s.idempotencyKey ?? s._id.toString()}:expiry-release`
        );
        await this.driveItems.markFailed(s.driveItemId).catch(() => undefined);

        await this.sessionModel.updateOne(
          { _id: s._id, status: s.status }, // guard concurrent modification
          { $set: { status: UploadStatus.EXPIRED } }
        );
        reaped++;
      } catch (err) {
        // KhÃ´ng Ä‘á»•i status -> reaper thá»­ láº¡i láº§n sau (idempotent).
        this.logger.error(`Reaper failed for session ${s._id}: ${err}. Will retry.`);
      }
    }
    return reaped;
  }
}
