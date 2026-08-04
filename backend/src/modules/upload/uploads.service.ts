import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { S3StorageAdapter } from './storage/s3-storage.adapter';
import { UploadSession, UploadMethod, UploadStatus } from './schemas/upload-session.schema';
import { UploadPart } from './schemas/upload-part.schema';
import { DriveItemsService } from '../drive-items/drive-items.service';
import { StorageObject, StorageProvider } from '../storage/storage-object.schema';
import {
    InitUploadDto,
    CompleteUploadDto,
    SINGLE_PART_MAX_BYTES,
    MIN_PART_SIZE_BYTES,
    MAX_PARTS_ALLOWED,
} from './dto/upload.dto';

// Interface tối giản cho các dependency đã tồn tại ở service khác
// (drive-items, quota) — inject thật theo module thật của bạn.
interface DriveItemsPort {
    createPlaceholder(args: {
        ownerId: Types.ObjectId;
        parentId: Types.ObjectId | null;
        name: string;
    }): Promise<{ id: Types.ObjectId }>;
    activateFile(args: {
        driveItemId: Types.ObjectId;
        storageObjectId: Types.ObjectId;
        mimeType: string;
        sizeBytes: bigint;
        extension: string | null;
    }): Promise<void>;
    markFailed(driveItemId: Types.ObjectId): Promise<void>;
}

interface QuotaPort {
    reserve(ownerId: Types.ObjectId, bytes: bigint, idempotencyKey: string): Promise<void>;
    commit(ownerId: Types.ObjectId, bytes: bigint, idempotencyKey: string): Promise<void>;
    release(ownerId: Types.ObjectId, bytes: bigint, idempotencyKey: string): Promise<void>;
}

interface StorageObjectsPort {
    create(args: {
        ownerId: Types.ObjectId;
        bucket: string;
        objectKey: string;
        sizeBytes: bigint;
        mimeType: string;
        checksumSha256: Buffer;
    }): Promise<{ id: Types.ObjectId }>;
}

@Injectable()
export class UploadsService {
    private readonly logger = new Logger(UploadsService.name);
    private readonly bucketName = process.env.STORAGE_BUCKET ?? 'file-central';
    private readonly sessionTtlMs = 24 * 60 * 60 * 1000; // 24h

    constructor(
        @InjectModel(UploadSession.name)
        private readonly sessionModel: Model<UploadSession>,
        @InjectModel(UploadPart.name)
        private readonly partModel: Model<UploadPart>,
        @InjectModel(StorageObject.name)
        private readonly storageObjectModel: Model<StorageObject>,
        private readonly storage: S3StorageAdapter,
        // Trong module thật: inject qua DI token của các module tương ứng
        private readonly driveItems: DriveItemsService,
    ) { }

    private readonly quota: QuotaPort = {
        reserve: async () => undefined,
        commit: async () => undefined,
        release: async () => undefined,
    };

    // ---------------------------------------------------------------------
    // 1. INIT — quyết định single vs multipart, reserve quota, tạo placeholder
    // ---------------------------------------------------------------------
    async initUpload(ownerId: Types.ObjectId, dto: InitUploadDto) {
        const declaredSizeBytes = BigInt(dto.declaredSizeBytes);
        if (declaredSizeBytes <= 0n) {
            throw new BadRequestException('declaredSizeBytes must be positive');
        }

        // Idempotency: nếu client retry cùng key, trả lại session đã có thay vì tạo mới
        const existing = await this.sessionModel.findOne({
            ownerId,
            idempotencyKey: dto.idempotencyKey,
        });
        if (existing) {
            return this.buildInitResponse(existing);
        }

        // 1a. Reserve quota trước — atomic, fail-fast nếu vượt hạn mức
        await this.quota.reserve(ownerId, declaredSizeBytes, dto.idempotencyKey);

        let driveItemId: Types.ObjectId;
        try {
            const placeholder = await this.driveItems.createPlaceholder({
                ownerId,
                parentId: dto.parentId ? new Types.ObjectId(dto.parentId) : null,
                name: dto.name,
            });
            driveItemId = placeholder.id;
        } catch (err) {
            // Rollback quota nếu tạo placeholder thất bại (vd trùng tên)
            await this.quota.release(ownerId, declaredSizeBytes, dto.idempotencyKey);
            throw err;
        }

        const sessionId = new Types.ObjectId();
        const objectKey = this.storage.buildObjectKey(
            ownerId.toHexString(),
            sessionId.toHexString(),
        );

        const useMultipart = declaredSizeBytes > BigInt(SINGLE_PART_MAX_BYTES);
        let providerUploadId: string | null = null;
        let partSizeBytes: number | null = null;
        let expectedPartsCount: number | null = null;

        if (useMultipart) {
            partSizeBytes = this.computePartSize(declaredSizeBytes);
            expectedPartsCount = Number(
                (declaredSizeBytes + BigInt(partSizeBytes) - 1n) / BigInt(partSizeBytes),
            );
            providerUploadId = await this.storage.createMultipartUpload(
                objectKey,
                dto.mimeTypeHint,
            );
        }

        const session = await this.sessionModel.create({
            _id: sessionId,
            ownerId,
            driveItemId,
            parentId: dto.parentId ? new Types.ObjectId(dto.parentId) : null,
            method: useMultipart ? UploadMethod.MULTIPART : UploadMethod.SINGLE,
            providerUploadId,
            temporaryObjectKey: objectKey,
            partSizeBytes,
            expectedPartsCount,
            declaredSizeBytes,
            declaredChecksumSha256: dto.declaredChecksumSha256Hex
                ? Buffer.from(dto.declaredChecksumSha256Hex, 'hex')
                : null,
            status: UploadStatus.PENDING,
            idempotencyKey: dto.idempotencyKey,
            expiresAt: new Date(Date.now() + this.sessionTtlMs),
        });

        // Pre-create part placeholders để client biết chính xác cần upload bao nhiêu part
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

    private computePartSize(totalBytes: bigint): number {
        const computed = Number(
            (totalBytes + BigInt(MAX_PARTS_ALLOWED) - 1n) / BigInt(MAX_PARTS_ALLOWED),
        );
        return Math.max(MIN_PART_SIZE_BYTES, computed);
    }

    private async buildInitResponse(session: UploadSession) {
        if (session.method === UploadMethod.SINGLE) {
            const putUrl = await this.storage.getPresignedPutUrl(
                session.temporaryObjectKey,
            );
            return {
                uploadSessionId: session._id.toString(),
                method: session.method,
                putUrl,
                expiresAt: session.expiresAt,
            };
        }

        // Multipart: trả presigned URL cho từng part còn thiếu (resume-friendly)
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
                    p.partNumber,
                ),
            })),
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

    // ---------------------------------------------------------------------
    // 2. STATUS — dùng khi client reconnect sau mất mạng, cần biết đã có part nào
    // ---------------------------------------------------------------------
    async getStatus(ownerId: Types.ObjectId, sessionId: Types.ObjectId) {
        const session = await this.sessionModel.findOne({
            _id: sessionId,
            ownerId,
        });
        if (!session) throw new NotFoundException('Upload session not found');

        if (session.expiresAt.getTime() <= Date.now()) {
            throw new ConflictException('Upload session has expired');
        }

        if (session.status === UploadStatus.COMPLETED) {
            return { status: session.status, driveItemId: session.driveItemId };
        }

        if (session.method === UploadMethod.SINGLE) {
            // Xác nhận trực tiếp với provider vì không có bảng part cho single-part
            const head = await this.storage.headObject(session.temporaryObjectKey);
            return {
                status: session.status,
                singlePartUploaded: head !== null,
            };
        }

        // Đối chiếu local upload_parts với thực tế trên provider — nguồn sự thật
        // cuối cùng luôn là provider (ListParts), local chỉ là cache tăng tốc.
        const remoteParts = await this.storage.listParts(
            session.temporaryObjectKey,
            session.providerUploadId!,
        );
        const remoteByNumber = new Map(remoteParts.map((p) => [p.partNumber, p]));

        const bulkOps = remoteParts.map((rp) => ({
            updateOne: {
                filter: { uploadSessionId: session._id, partNumber: rp.partNumber },
                update: {
                    $set: { etag: rp.etag, sizeBytes: BigInt(rp.sizeBytes) },
                },
            },
        }));
        if (bulkOps.length > 0) {
            await this.partModel.bulkWrite(bulkOps, { ordered: false });
        }

        const allParts = await this.partModel
            .find({ uploadSessionId: session._id })
            .sort({ partNumber: 1 })
            .lean();

        const missingPartNumbers = allParts
            .filter((p) => !remoteByNumber.has(p.partNumber))
            .map((p) => p.partNumber);

        let missingPartUrls: { partNumber: number; url: string }[] = [];
        if (missingPartNumbers.length > 0) {
            missingPartUrls = await Promise.all(
                missingPartNumbers.map(async (pn) => ({
                    partNumber: pn,
                    url: await this.storage.getPresignedPartUrl(
                        session.temporaryObjectKey,
                        session.providerUploadId!,
                        pn,
                    ),
                })),
            );
        }

        return {
            status: session.status,
            totalParts: allParts.length,
            uploadedParts: allParts.length - missingPartNumbers.length,
            uploadedPartNumbers: remoteParts.map((part) => part.partNumber).sort((a, b) => a - b),
            missingPartUrls,
        };
    }

    // ---------------------------------------------------------------------
    // 3. COMPLETE — verify, finalize storage object, activate drive item, commit quota
    // ---------------------------------------------------------------------
    async completeUpload(
        ownerId: Types.ObjectId,
        sessionId: Types.ObjectId,
        dto: CompleteUploadDto,
    ) {
        const session = await this.sessionModel.findOne({
            _id: sessionId,
            ownerId,
        });
        if (!session) throw new NotFoundException('Upload session not found');

        if (session.expiresAt.getTime() <= Date.now()) {
            throw new ConflictException('Upload session has expired');
        }

        if (session.status === UploadStatus.COMPLETED) {
            // Idempotent retry: trả lại kết quả trước đó, không xử lý lại
            return { driveItemId: session.driveItemId, status: session.status };
        }

        if (
            session.status !== UploadStatus.PENDING &&
            session.status !== UploadStatus.UPLOADED
        ) {
            throw new ConflictException(
                `Cannot complete session in status ${session.status}`,
            );
        }

        // Keep an incomplete multipart session resumable. Do not transition it
        // to FAILED merely because the user pressed complete before all chunks arrived.
        if (session.method === UploadMethod.MULTIPART) {
            const uploadedParts = await this.storage.listParts(
                session.temporaryObjectKey,
                session.providerUploadId!,
            );
            if (uploadedParts.length !== (session.expectedPartsCount ?? 0)) {
                throw new BadRequestException(
                    `Expected ${session.expectedPartsCount ?? 0} parts, uploaded ${uploadedParts.length}`,
                );
            }
        }

        session.status = UploadStatus.PROCESSING;
        await session.save();

        try {
            let finalSizeBytes: bigint;

            if (session.method === UploadMethod.MULTIPART) {
                const remoteParts = await this.storage.listParts(
                    session.temporaryObjectKey,
                    session.providerUploadId!,
                );
                // Validate đủ part trước khi gọi provider — tránh CompleteMultipartUpload
                // thất bại giữa chừng gây trạng thái khó rollback.
                const expected = session.expectedPartsCount ?? 0;
                if (remoteParts.length !== expected) {
                    throw new BadRequestException(
                        `Expected ${expected} parts, uploaded ${remoteParts.length}`,
                    );
                }
                const actualNumbers = remoteParts
                    .map((part) => part.partNumber)
                    .sort((a, b) => a - b);
                if (actualNumbers.some((partNumber, index) => partNumber !== index + 1)) {
                    throw new BadRequestException('Multipart upload contains missing or invalid part numbers');
                }
                await this.storage.completeMultipartUpload(
                    session.temporaryObjectKey,
                    session.providerUploadId!,
                    remoteParts,
                );
                finalSizeBytes = remoteParts.reduce(
                    (sum, p) => sum + BigInt(p.sizeBytes),
                    0n,
                );
            } else {
                const head = await this.storage.headObject(session.temporaryObjectKey);
                if (!head) {
                    throw new BadRequestException('Object not found on storage — upload incomplete');
                }
                finalSizeBytes = BigInt(head.sizeBytes);
            }

            // Verify declared size (best-effort — checksum thật cần streaming hash,
            // ở đây minh hoạ so khớp kích thước; production nên có worker verify
            // checksum bằng cách đọc lại object hoặc dùng SSE checksum của provider).
            const declared = BigInt(session.declaredSizeBytes);
            if (finalSizeBytes !== declared) {
                throw new BadRequestException(
                    `Size mismatch: declared ${declared}, actual ${finalSizeBytes}`,
                );
            }

            const mimeType =
                (await this.storage.headObject(session.temporaryObjectKey))
                    ?.contentType ?? 'application/octet-stream';
            const extension = null;
            const verifiedChecksum = await this.storage.calculateSha256(session.temporaryObjectKey);
            if (session.declaredChecksumSha256 && !verifiedChecksum.equals(session.declaredChecksumSha256)) {
                throw new BadRequestException('SHA-256 checksum mismatch');
            }
            if (
                dto.clientChecksumSha256Hex &&
                verifiedChecksum.toString('hex') !== dto.clientChecksumSha256Hex.toLowerCase()
            ) {
                throw new BadRequestException('Client SHA-256 checksum mismatch');
            }
            session.verifiedChecksumSha256 = verifiedChecksum;

            const storageObject = await this.storageObjectModel.create({
                ownerId,
                provider: StorageProvider.MINIO,
                bucket: this.bucketName,
                objectKey: session.temporaryObjectKey,
                sizeBytes: finalSizeBytes,
                mimeType,
                checksumSha256: verifiedChecksum,
            });

            await this.driveItems.activateFile({
                driveItemId: session.driveItemId,
                storageObjectId: storageObject._id,
                mimeType,
                sizeBytes: finalSizeBytes,
                extension,
            });

            await this.quota.commit(
                ownerId,
                finalSizeBytes,
                session.idempotencyKey ?? session._id.toString(),
            );

            // Nếu quota thực tế < declared (hiếm, nhưng có thể xảy ra), release phần dư
            const reservedExtra = declared - finalSizeBytes;
            if (reservedExtra > 0n) {
                await this.quota.release(
                    ownerId,
                    reservedExtra,
                    `${session.idempotencyKey}:adjust`,
                );
            }

            session.status = UploadStatus.COMPLETED;
            session.actualSizeBytes = finalSizeBytes;
            await session.save();

            return { driveItemId: session.driveItemId, status: session.status };
        } catch (err) {
            session.status = UploadStatus.FAILED;
            session.errorCode = err instanceof Error ? err.message : 'UNKNOWN_ERROR';
            await session.save();
            await this.driveItems.markFailed(session.driveItemId);
            throw err;
        }
    }

    private extractExtension(name: string): string | null {
        const idx = name.lastIndexOf('.');
        return idx > 0 ? name.slice(idx + 1).toLowerCase() : null;
    }

    // ---------------------------------------------------------------------
    // 4. ABORT — client chủ động huỷ (vd người dùng bấm Cancel)
    // ---------------------------------------------------------------------
    async abortUpload(ownerId: Types.ObjectId, sessionId: Types.ObjectId) {
        const session = await this.sessionModel.findOne({
            _id: sessionId,
            ownerId,
        });
        if (!session) throw new NotFoundException('Upload session not found');
        if (session.status === UploadStatus.COMPLETED) {
            throw new ConflictException('Cannot abort a completed upload');
        }

        if (session.method === UploadMethod.MULTIPART && session.providerUploadId) {
            await this.storage.abortMultipartUpload(
                session.temporaryObjectKey,
                session.providerUploadId,
            );
        } else {
            await this.storage.deleteObject(session.temporaryObjectKey).catch(() => {
                // best-effort — object có thể chưa từng được PUT
            });
        }

        await this.quota.release(
            ownerId,
            BigInt(session.declaredSizeBytes),
            session.idempotencyKey ?? session._id.toString(),
        );
        await this.driveItems.markFailed(session.driveItemId);

        session.status = UploadStatus.ABORTED;
        await session.save();
        return { status: session.status };
    }

    // ---------------------------------------------------------------------
    // 5. REAPER — chạy định kỳ (cron), xử lý session hết hạn do mất mạng vĩnh viễn
    //    hoặc client crash không bao giờ gọi complete/abort.
    // ---------------------------------------------------------------------
    async reapExpiredSessions(batchSize = 100): Promise<number> {
        const now = new Date();
        const expiredSessions = await this.sessionModel
            .find({
                status: { $in: [UploadStatus.PENDING, UploadStatus.UPLOADED, UploadStatus.PROCESSING] },
                expiresAt: { $lt: now },
            })
            .limit(batchSize)
            .lean();

        let reaped = 0;
        for (const s of expiredSessions) {
            try {
                if (s.method === UploadMethod.MULTIPART && s.providerUploadId) {
                    await this.storage.abortMultipartUpload(
                        s.temporaryObjectKey,
                        s.providerUploadId,
                    );
                } else {
                    await this.storage.deleteObject(s.temporaryObjectKey).catch(() => { });
                }

                await this.quota.release(
                    s.ownerId,
                    BigInt(s.declaredSizeBytes),
                    s.idempotencyKey ?? s._id.toString(),
                );
                await this.driveItems.markFailed(s.driveItemId);

                await this.sessionModel.updateOne(
                    { _id: s._id, status: s.status }, // guard against concurrent modification
                    { $set: { status: UploadStatus.EXPIRED } },
                );
                reaped++;
            } catch (err) {
                this.logger.error(
                    `Reaper failed for session ${s._id}: ${err}. Will retry next run.`,
                );
                // Không update status -> session vẫn "expired-eligible", reaper sẽ thử lại
                // ở lần chạy sau. Idempotent theo thiết kế (abort/release đều an toàn để lặp lại).
            }
        }
        return reaped;
    }
}
