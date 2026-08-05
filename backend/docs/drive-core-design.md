# Thiết kế Drive Core — drive_items + storage_objects + Permission / Preview / Move / Trash

Tài liệu khung để tự hoàn thiện. Các đoạn `// TODO` và `// [BẠN HOÀN THIỆN]` là nơi cần điền logic thật.

**Nguyên tắc phân tách dữ liệu (cốt lõi):**
- **MongoDB** giữ *metadata*: tên, cây thư mục, trạng thái, quyền, trash. Không bao giờ chứa byte file.
- **MinIO** giữ *data*: byte vật lý của file, key opaque, immutable.
- Cầu nối duy nhất: `drive_items.storageObjectId` → `storage_objects._id` → (`bucket`, `objectKey`) trong MinIO.
- Rename/move/star/share/trash/restore = **chỉ đụng metadata Mongo**, không đổi object trong MinIO.

```
drive_items (Mongo)  ──storageObjectId──▶  storage_objects (Mongo)  ──objectKey──▶  MinIO object (byte)
   metadata logic                            metadata vật lý                          data thật
```

---

## 0. Enums (khớp type bạn đang dùng)

```ts
// modules/drive-items/enums/drive-item.enum.ts
export enum DriveItemType {
  FILE = 'file',
  FOLDER = 'folder',
}

export enum FileStatus {
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  ACTIVE = 'active',
  FAILED = 'failed',
}
```

```ts
// modules/storage/enums/storage-object.enum.ts
export enum StorageProvider {
  LOCAL = 'local',
  MINIO = 'minio',
  S3 = 's3',
}

export enum ScanStatus {
  NOT_REQUESTED = 'not_requested',
  PENDING = 'pending',
  CLEAN = 'clean',
  INFECTED = 'infected',
  FAILED = 'failed',
}

export enum StorageObjectState {
  ACTIVE = 'active',
  DELETING = 'deleting',
  DELETE_FAILED = 'delete_failed',
}
```

Type domain của bạn (`DriveItemBase`, `FileDriveItem`, `FolderDriveItem`, `DriveItem`,
`DriveItemResponse`) giữ nguyên — schema Mongoose bên dưới ánh xạ đúng vào các type đó.

---

## 1. Schema `drive_items` (Mongoose)

Ánh xạ 1-1 với `DriveItem` type của bạn. Lưu ý: dùng discriminator theo `type` ở tầng
service (không cần Mongoose discriminator), field của file/folder cùng nằm 1 collection.

```ts
// modules/drive-items/schemas/drive-item.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { DriveItemType, FileStatus } from '../enums/drive-item.enum';

@Schema({ collection: 'drive_items', versionKey: false })
export class DriveItemDoc extends Document {
  declare _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  ownerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, default: null })
  parentId: Types.ObjectId | null;

  @Prop({ type: [Types.ObjectId], default: [] })
  ancestorIds: Types.ObjectId[];

  @Prop({ type: String, required: true, maxlength: 255 })
  name: string;

  // NFC + case-fold. Không bao giờ serialize ra client.
  @Prop({ type: String, required: true, maxlength: 255 })
  normalizedName: string;

  @Prop({ type: String, enum: DriveItemType, required: true })
  type: DriveItemType;

  // ---- Field chỉ dùng cho FILE (folder = null) ----
  @Prop({ type: Types.ObjectId, default: null })
  storageObjectId: Types.ObjectId | null;

  @Prop({ type: String, enum: FileStatus, default: null })
  fileStatus: FileStatus | null;

  @Prop({ type: String, default: null })
  mimeType: string | null;

  // Int64. TODO: BigInt hay mongoose-long tuỳ phiên bản (xem guide quota).
  @Prop({ type: BigInt, default: null })
  sizeBytes: bigint | null;

  @Prop({ type: String, default: null, maxlength: 32 })
  extension: string | null;

  // ---- Field chỉ dùng cho FOLDER (file = null) ----
  @Prop({ type: Number, default: null }) // Int32, approximate
  childCount: number | null;

  // ---- Trash ----
  @Prop({ type: Boolean, required: true, default: false })
  isTrashed: boolean;

  @Prop({ type: Date, default: null })
  trashedAt: Date | null;

  // ---- Optimistic concurrency cho METADATA (không phải content) ----
  @Prop({ type: Number, required: true, default: 1 })
  metadataVersion: number;

  createdAt: Date;
  updatedAt: Date;

  @Prop({ type: Date, required: true, default: () => new Date() })
  lastModifiedAt: Date;
}

export const DriveItemSchema = SchemaFactory.createForClass(DriveItemDoc);
DriveItemSchema.set('timestamps', true); // tạo createdAt, updatedAt

// ----- Indexes (đúng schema mục 6.3) -----
// List folder mặc định theo thời gian.
DriveItemSchema.index({ ownerId: 1, parentId: 1, isTrashed: 1, lastModifiedAt: -1, _id: -1 });
// List theo tên: folder trước, rồi tên.
DriveItemSchema.index({ ownerId: 1, parentId: 1, isTrashed: 1, type: -1, normalizedName: 1, _id: 1 });
// Unique tên trong 1 folder (chỉ tính item chưa trash).
DriveItemSchema.index(
  { ownerId: 1, parentId: 1, normalizedName: 1 },
  { unique: true, partialFilterExpression: { isTrashed: false } },
);
// Breadcrumb / subtree / cycle-check / permission kế thừa.
DriveItemSchema.index({ ownerId: 1, ancestorIds: 1, isTrashed: 1 });
// Trash list.
DriveItemSchema.index({ ownerId: 1, isTrashed: 1, trashedAt: -1, _id: -1 });
// Recover upload treo.
DriveItemSchema.index({ ownerId: 1, fileStatus: 1, createdAt: 1 });
```

### Invariant bắt buộc (service phải giữ)

- **Folder:** `fileStatus/storageObjectId/mimeType/sizeBytes/extension = null`, `childCount >= 0`.
- **File:** `childCount = null`. `fileStatus="active"` ⇒ `storageObjectId/mimeType/sizeBytes` non-null.
- `parentId=null` ⇔ `ancestorIds=[]`. Item không-root ⇒ `ancestorIds[last] == parentId`.
- `ancestorIds` không chứa chính nó. Toàn bộ ancestor phải `type="folder"` cùng `ownerId`.
- Depth ≤ `MAX_FOLDER_DEPTH` (64). Move không được vào chính nó/subtree của nó.
- `isTrashed=false` ⇔ `trashedAt=null`.

---

## 2. Schema `storage_objects`

Không bao giờ serialize trực tiếp ra client. `bucket`/`objectKey` là bí mật nội bộ.

```ts
// modules/storage/schemas/storage-object.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  ScanStatus,
  StorageObjectState,
  StorageProvider,
} from '../enums/storage-object.enum';

@Schema({ collection: 'storage_objects', versionKey: false })
export class StorageObjectDoc extends Document {
  declare _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  ownerId: Types.ObjectId;

  @Prop({ type: String, enum: StorageProvider, required: true })
  provider: StorageProvider;

  @Prop({ type: String, required: true })
  bucket: string;

  // Opaque, immutable, KHÔNG liên quan tên hiển thị. Ví dụ: objects/{ownerId}/{objectId}
  @Prop({ type: String, required: true })
  objectKey: string;

  @Prop({ type: BigInt, required: true })
  sizeBytes: bigint;

  @Prop({ type: String, required: true })
  mimeType: string;

  // SHA-256 dạng Binary(32), KHÔNG lưu hex 64 ký tự.
  @Prop({ type: Buffer, required: true })
  checksumSha256: Buffer;

  @Prop({ type: String, enum: ScanStatus, default: ScanStatus.NOT_REQUESTED })
  scanStatus: ScanStatus;

  @Prop({ type: String, enum: StorageObjectState, default: StorageObjectState.ACTIVE })
  state: StorageObjectState;

  createdAt: Date;
  updatedAt: Date;
}

export const StorageObjectSchema = SchemaFactory.createForClass(StorageObjectDoc);
StorageObjectSchema.set('timestamps', true);

StorageObjectSchema.index({ provider: 1, bucket: 1, objectKey: 1 }, { unique: true });
StorageObjectSchema.index({ ownerId: 1, createdAt: -1, _id: -1 });
// Dọn rác: tìm object đang deleting/delete_failed.
StorageObjectSchema.index({ state: 1, updatedAt: 1, _id: 1 });
```

---

## 3. StorageObjectsService (cầu nối MinIO)

Hiện thực `StorageObjectsPort` mà upload service đang cần.

```ts
// modules/storage/storage-objects.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { StorageObjectDoc } from './schemas/storage-object.schema';
import { StorageObjectState, StorageProvider } from './enums/storage-object.enum';
import { S3StorageAdapter } from './s3-storage.adapter'; // adapter đã có từ trước

@Injectable()
export class StorageObjectsService {
  constructor(
    @InjectModel(StorageObjectDoc.name)
    private readonly model: Model<StorageObjectDoc>,
    private readonly storage: S3StorageAdapter,
  ) {}

  // Gọi bởi upload service khi finalize. Object đã nằm trên MinIO rồi.
  async create(args: {
    ownerId: Types.ObjectId;
    bucket: string;
    objectKey: string;
    sizeBytes: bigint;
    mimeType: string;
    checksumSha256: Buffer;
  }): Promise<{ id: Types.ObjectId }> {
    const doc = await this.model.create({
      ownerId: args.ownerId,
      provider: StorageProvider.MINIO,
      bucket: args.bucket,
      objectKey: args.objectKey,
      sizeBytes: args.sizeBytes,
      mimeType: args.mimeType,
      checksumSha256: args.checksumSha256,
      state: StorageObjectState.ACTIVE,
    });
    return { id: doc._id };
  }

  // Cấp URL preview/download ngắn hạn. KHÔNG lộ bucket/objectKey ra ngoài.
  async getPresignedDownloadUrl(
    storageObjectId: Types.ObjectId,
    ownerId: Types.ObjectId,
  ): Promise<string> {
    const obj = await this.model.findOne({ _id: storageObjectId, ownerId });
    if (!obj || obj.state !== StorageObjectState.ACTIVE) {
      throw new NotFoundException('STORAGE_OBJECT_UNAVAILABLE');
    }
    // TODO: adapter cần method getPresignedGetUrl(objectKey, { expiresIn, responseContentType })
    return this.storage.getPresignedGetUrl(obj.objectKey);
  }

  // Xoá vật lý idempotent (dùng bởi hard-delete). Đánh dấu deleting -> xoá MinIO -> xoá doc.
  async permanentDelete(storageObjectId: Types.ObjectId): Promise<void> {
    const obj = await this.model.findById(storageObjectId);
    if (!obj) return; // đã xoá rồi -> idempotent

    await this.model.updateOne(
      { _id: obj._id },
      { $set: { state: StorageObjectState.DELETING } },
    );

    try {
      await this.storage.deleteObject(obj.objectKey);
      await this.model.deleteOne({ _id: obj._id });
    } catch (err) {
      // Giữ trạng thái delete_failed để worker retry. KHÔNG báo xoá thành công.
      await this.model.updateOne(
        { _id: obj._id },
        { $set: { state: StorageObjectState.DELETE_FAILED } },
      );
      throw err;
    }
  }
}
```

---

## 3b. MIME type & extension — detect CHUẨN (không tin client)

**Nguyên tắc:** MIME phải lấy từ **magic bytes (byte thật của file)**, KHÔNG tin extension
người dùng gõ, cũng KHÔNG tin `Content-Type` client gửi. Kẻ tấn công đổi tên `virus.exe`
→ `photo.jpg`; nếu tin extension, bạn lưu sai MIME và có thể serve sai/nguy hiểm.

### Thư viện (Node/NestJS, 2026)

| Gói | Việc | Ghi chú |
|---|---|---|
| **`file-type`** | Nguồn sự thật: MIME + ext từ **magic bytes** | ESM-only từ v19 → phải `import()` động trong NestJS CommonJS. Câm với text/csv/svg. |
| **`mime-types`** | Fallback: tra MIME ↔ extension khi magic bytes không nhận ra | CommonJS, đồng bộ, zero-dep. |

Bỏ `mmmagic` (native libmagic, cần build tools, không chạy serverless) trừ khi có nhu cầu đặc biệt.

```bash
npm install file-type mime-types
npm install -D @types/mime-types
```

### Lấy magic bytes ở đâu — byte KHÔNG đi qua NestJS

Vì upload đi thẳng lên MinIO qua presigned, khi finalize ta **đọc ~4KB đầu object từ MinIO**
(chỉ cần đầu file là đủ magic bytes, không tải cả file GB), chạy `file-type` trên chunk đó.
Kết quả gán vào `storage_objects.mimeType` (đã verify) + `drive_items.mimeType/extension`.

### Service detect

```ts
// modules/storage/mime-detector.service.ts
import { Injectable } from '@nestjs/common';
import * as mimeTypes from 'mime-types'; // CommonJS OK

@Injectable()
export class MimeDetectorService {
  // head = ~4KB đầu object (Range bytes=0-4100). fileName = tên user đặt.
  async detect(
    head: Buffer,
    fileName: string,
  ): Promise<{ mimeType: string; extension: string | null }> {
    // file-type ESM-only -> dynamic import trong NestJS CommonJS.
    const { fileTypeFromBuffer } = await import('file-type');
    const ft = await fileTypeFromBuffer(head);

    const extFromName = this.extFromName(fileName);

    if (ft) {
      // Magic bytes nhận ra -> nguồn sự thật.
      // [BẠN HOÀN THIỆN]: cross-check ft.ext với extFromName; nếu lệch nhiều
      // (vd tên .pdf nhưng magic bytes là zip) -> log/cảnh báo. Ưu tiên ft.ext.
      return { mimeType: ft.mime, extension: ft.ext };
    }

    // Fallback cho text/csv/svg... magic bytes câm.
    const mimeFromExt = extFromName ? mimeTypes.lookup(extFromName) : false;
    return {
      mimeType: mimeFromExt || 'application/octet-stream',
      extension: extFromName,
    };
  }

  private extFromName(name: string): string | null {
    const idx = name.lastIndexOf('.');
    return idx > 0 ? name.slice(idx + 1).toLowerCase() : null;
  }
}
```

### Method cần thêm vào S3StorageAdapter

```ts
// Đọc 1 khoảng byte (dùng cho detect MIME khi finalize).
async getObjectRange(objectKey: string, start: number, end: number): Promise<Buffer> {
  const res = await this.client.send(
    new GetObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      Range: `bytes=${start}-${end}`,
    }),
  );
  const chunks: Buffer[] = [];
  for await (const chunk of res.Body as any) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
```

### Dùng khi finalize upload (thay chỗ placeholder MIME trước đây)

```ts
// Trong UploadsService.completeUpload, sau khi object đã nằm trên MinIO:
const head = await this.storage.getObjectRange(objectKey, 0, 4100); // ~4KB đầu
const { mimeType, extension } = await this.mimeDetector.detect(head, fileName);

// mimeType, extension này dùng cho:
//   - storageObjects.create({ ..., mimeType })
//   - driveItems.activateFile({ ..., mimeType, extension })
```

### Lưu ý

- **Ưu tiên `ft.ext` (từ magic bytes) hơn extension của tên file.** Chỉ rơi về extension
  tên file khi magic bytes câm. Tránh `document.pdf` thực chất là zip.
- Magic-byte detection là *best-effort hint*, không đảm bảo file hợp lệ/không hỏng. Với
  file quan trọng nên cross-check ext ↔ magic bytes.
- **`extractExtension` từ tên file** (dùng trong rename ở mục 4) chỉ là fallback hiển thị;
  khi activate file mới, extension ĐÃ VERIFY nên đến từ `MimeDetectorService`, không phải
  từ tên do user gõ.

---

## 4. DriveItemsService — khung các thao tác chính

Hiện thực `DriveItemsPort` (upload) + các thao tác Drive.

```ts
// modules/drive-items/drive-items.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DriveItemDoc } from './schemas/drive-item.schema';
import { DriveItemType, FileStatus } from './enums/drive-item.enum';

const MAX_FOLDER_DEPTH = 64;

@Injectable()
export class DriveItemsService {
  constructor(
    @InjectModel(DriveItemDoc.name)
    private readonly model: Model<DriveItemDoc>,
    // TODO: inject PermissionService (mục 6) để check quyền khi share/preview/move.
  ) {}

  // -------- helper normalize tên (NFC + case-fold) --------
  private normalize(name: string): string {
    // [BẠN HOÀN THIỆN]: chuẩn hoá thật (NFC + toLowerCase + trim + collapse spaces).
    return name.normalize('NFC').trim().toLowerCase();
  }

  private extractExtension(name: string): string | null {
    const idx = name.lastIndexOf('.');
    return idx > 0 ? name.slice(idx + 1).toLowerCase() : null;
  }

  // ============================================================
  // A. FOLDER — tạo
  // ============================================================
  async createFolder(args: {
    ownerId: Types.ObjectId;
    parentId: Types.ObjectId | null;
    name: string;
  }): Promise<DriveItemDoc> {
    const ancestorIds = await this.resolveAncestors(args.ownerId, args.parentId);
    if (ancestorIds.length + 1 > MAX_FOLDER_DEPTH) {
      throw new BadRequestException('MAX_DEPTH_EXCEEDED');
    }
    try {
      return await this.model.create({
        ownerId: args.ownerId,
        parentId: args.parentId,
        ancestorIds,
        name: args.name,
        normalizedName: this.normalize(args.name),
        type: DriveItemType.FOLDER,
        childCount: 0,
      });
    } catch (err: any) {
      if (err?.code === 11000) throw new ConflictException('NAME_ALREADY_EXISTS');
      throw err;
    }
  }

  // Lấy ancestorIds cho parent, đồng thời validate parent là folder cùng owner.
  private async resolveAncestors(
    ownerId: Types.ObjectId,
    parentId: Types.ObjectId | null,
  ): Promise<Types.ObjectId[]> {
    if (!parentId) return [];
    const parent = await this.model.findOne({
      _id: parentId,
      ownerId,
      type: DriveItemType.FOLDER,
      isTrashed: false,
    });
    if (!parent) throw new NotFoundException('PARENT_NOT_FOUND');
    return [...parent.ancestorIds, parent._id];
  }

  // ============================================================
  // B. UPLOAD placeholder / activate / fail  (DriveItemsPort)
  // ============================================================
  async createPlaceholder(args: {
    ownerId: Types.ObjectId;
    parentId: Types.ObjectId | null;
    name: string;
  }): Promise<{ id: Types.ObjectId }> {
    const ancestorIds = await this.resolveAncestors(args.ownerId, args.parentId);
    try {
      const doc = await this.model.create({
        ownerId: args.ownerId,
        parentId: args.parentId,
        ancestorIds,
        name: args.name,
        normalizedName: this.normalize(args.name),
        type: DriveItemType.FILE,
        fileStatus: FileStatus.UPLOADING, // chưa có storageObjectId
        storageObjectId: null,
        childCount: null,
      });
      return { id: doc._id };
    } catch (err: any) {
      if (err?.code === 11000) throw new ConflictException('NAME_ALREADY_EXISTS');
      throw err;
    }
  }

  async activateFile(args: {
    driveItemId: Types.ObjectId;
    storageObjectId: Types.ObjectId;
    // mimeType & extension ĐÃ VERIFY, đến từ MimeDetectorService (mục 3b),
    // KHÔNG phải từ tên file do user gõ.
    mimeType: string;
    sizeBytes: bigint;
    extension: string | null;
  }): Promise<void> {
    const res = await this.model.updateOne(
      { _id: args.driveItemId, type: DriveItemType.FILE },
      {
        $set: {
          storageObjectId: args.storageObjectId,
          fileStatus: FileStatus.ACTIVE,
          mimeType: args.mimeType,
          sizeBytes: args.sizeBytes,
          extension: args.extension,
          lastModifiedAt: new Date(),
        },
        $inc: { metadataVersion: 1 },
      },
    );
    if (res.matchedCount === 0) throw new NotFoundException('DRIVE_ITEM_NOT_FOUND');
    // TODO: coalesced update childCount của parent (+1). Xem mục 7.
  }

  async markFailed(driveItemId: Types.ObjectId): Promise<void> {
    await this.model.updateOne(
      { _id: driveItemId, type: DriveItemType.FILE },
      { $set: { fileStatus: FileStatus.FAILED } },
    );
  }

  // ============================================================
  // C. RENAME  (optimistic concurrency theo metadataVersion)
  // ============================================================
  async rename(args: {
    ownerId: Types.ObjectId;
    itemId: Types.ObjectId;
    name: string;
    expectedMetadataVersion: number;
  }): Promise<DriveItemDoc> {
    try {
      const updated = await this.model.findOneAndUpdate(
        {
          _id: args.itemId,
          ownerId: args.ownerId,
          metadataVersion: args.expectedMetadataVersion,
          isTrashed: false,
        },
        {
          $set: {
            name: args.name,
            normalizedName: this.normalize(args.name),
            extension: this.extractExtension(args.name), // chỉ ý nghĩa với file
            lastModifiedAt: new Date(),
          },
          $inc: { metadataVersion: 1 },
        },
        { returnDocument: 'after' },
      );
      if (!updated) {
        // null = not found / forbidden / version conflict
        throw new ConflictException('DRIVE_ITEM_VERSION_CONFLICT');
      }
      return updated;
    } catch (err: any) {
      if (err?.code === 11000) throw new ConflictException('NAME_ALREADY_EXISTS');
      throw err;
    }
  }

  // ============================================================
  // D. MOVE  (chống cycle, cập nhật ancestorIds)
  // ============================================================
  async move(args: {
    ownerId: Types.ObjectId;
    itemId: Types.ObjectId;
    newParentId: Types.ObjectId | null;
    expectedMetadataVersion: number;
  }): Promise<void> {
    const item = await this.model.findOne({ _id: args.itemId, ownerId: args.ownerId });
    if (!item) throw new NotFoundException('DRIVE_ITEM_NOT_FOUND');

    // Chống cycle: đích không được là chính nó hoặc nằm TRONG subtree của nó.
    if (args.newParentId) {
      if (args.newParentId.equals(item._id)) {
        throw new BadRequestException('CANNOT_MOVE_INTO_ITSELF');
      }
      const dest = await this.model.findOne({
        _id: args.newParentId,
        ownerId: args.ownerId,
        type: DriveItemType.FOLDER,
        isTrashed: false,
      });
      if (!dest) throw new NotFoundException('DESTINATION_NOT_FOUND');
      if (dest.ancestorIds.some((a) => a.equals(item._id))) {
        throw new BadRequestException('CANNOT_MOVE_INTO_SUBTREE');
      }
    }

    const newAncestors = await this.resolveAncestors(args.ownerId, args.newParentId);
    if (newAncestors.length + 1 > MAX_FOLDER_DEPTH) {
      throw new BadRequestException('MAX_DEPTH_EXCEEDED');
    }

    // Cập nhật item gốc (optimistic).
    const updated = await this.model.findOneAndUpdate(
      {
        _id: item._id,
        ownerId: args.ownerId,
        metadataVersion: args.expectedMetadataVersion,
        isTrashed: false,
      },
      {
        $set: {
          parentId: args.newParentId,
          ancestorIds: newAncestors,
          lastModifiedAt: new Date(),
        },
        $inc: { metadataVersion: 1 },
      },
      { returnDocument: 'after' },
    );
    if (!updated) throw new ConflictException('DRIVE_ITEM_VERSION_CONFLICT');

    // ---- Nếu là FOLDER: phải cập nhật ancestorIds của TOÀN BỘ descendant ----
    if (item.type === DriveItemType.FOLDER) {
      // [BẠN HOÀN THIỆN]: đây là thao tác O(subtree).
      //   - Đếm descendant trước. Nếu > MAX_SYNC_SUBTREE_ITEMS -> từ chối,
      //     hoặc đẩy sang worker (schema mục 19). MVP: giới hạn đồng bộ.
      //   - Cách rewrite: với mỗi descendant, phần ancestorIds cũ từ item trở
      //     lên (prefix cũ) thay bằng newAncestors + item._id.
      //
      //   const oldPrefix = [...item.ancestorIds, item._id];
      //   const newPrefix = [...newAncestors, item._id];
      //   Duyệt theo bounded batch qua index {ownerId, ancestorIds}:
      //     tìm { ownerId, ancestorIds: item._id }
      //     mỗi doc: ancestorIds = newPrefix + phần đuôi sau item._id (giữ nguyên)
      await this.rewriteSubtreeAncestors(args.ownerId, item._id);
    }
    // TODO: cập nhật childCount parent cũ (-1) và parent mới (+1).
  }

  private async rewriteSubtreeAncestors(
    ownerId: Types.ObjectId,
    rootId: Types.ObjectId,
  ): Promise<void> {
    // [BẠN HOÀN THIỆN]: bounded-batch rewrite. Xem ghi chú trong move().
    // Gợi ý dùng cursor + bulkWrite theo lô ~500 doc.
  }

  // ============================================================
  // E. TRASH (xóa mềm)  &  RESTORE
  // ============================================================
  async trash(args: {
    ownerId: Types.ObjectId;
    itemId: Types.ObjectId;
  }): Promise<void> {
    const item = await this.model.findOne({ _id: args.itemId, ownerId: args.ownerId });
    if (!item) throw new NotFoundException('DRIVE_ITEM_NOT_FOUND');
    if (item.isTrashed) return; // idempotent

    const now = new Date();
    await this.model.updateOne(
      { _id: item._id },
      { $set: { isTrashed: true, trashedAt: now, lastModifiedAt: now } },
    );

    if (item.type === DriveItemType.FOLDER) {
      // [BẠN HOÀN THIỆN]: trash cả subtree. Bounded batch nếu lớn (mục 19).
      // Đánh dấu isTrashed=true, trashedAt=now cho mọi descendant:
      //   updateMany({ ownerId, ancestorIds: item._id, isTrashed: false }, ...)
      // Lưu ý: khi restore cần biết item nào bị trash do folder cha vs tự trash.
      //   -> cân nhắc thêm field `trashedRootId` để restore đúng phạm vi.
      await this.model.updateMany(
        { ownerId: args.ownerId, ancestorIds: item._id, isTrashed: false },
        { $set: { isTrashed: true, trashedAt: now } },
      );
    }
    // TODO: childCount parent -1 (coalesced).
    // Lưu ý: KHÔNG xoá object MinIO khi trash. Byte vẫn còn để restore.
  }

  async restore(args: {
    ownerId: Types.ObjectId;
    itemId: Types.ObjectId;
  }): Promise<void> {
    const item = await this.model.findOne({ _id: args.itemId, ownerId: args.ownerId });
    if (!item) throw new NotFoundException('DRIVE_ITEM_NOT_FOUND');
    if (!item.isTrashed) return;

    // [BẠN HOÀN THIỆN]: nếu parent đã bị xoá cứng/không tồn tại -> restore về root,
    // hoặc chặn và yêu cầu chọn folder đích. Quyết định UX.
    // Kiểm tra va chạm tên ở folder đích (unique index chỉ tính isTrashed=false).
    const now = new Date();
    try {
      await this.model.updateOne(
        { _id: item._id },
        { $set: { isTrashed: false, trashedAt: null, lastModifiedAt: now } },
      );
    } catch (err: any) {
      if (err?.code === 11000) {
        // Trùng tên với item đang active ở folder đích.
        throw new ConflictException('NAME_CONFLICT_ON_RESTORE');
      }
      throw err;
    }

    if (item.type === DriveItemType.FOLDER) {
      // Restore subtree (chỉ những item bị trash cùng đợt — xem trashedRootId).
      await this.model.updateMany(
        { ownerId: args.ownerId, ancestorIds: item._id, isTrashed: true },
        { $set: { isTrashed: false, trashedAt: null } },
      );
    }
  }

  // ============================================================
  // F. PERMANENT DELETE (xóa cứng trong thùng rác)
  // ============================================================
  async permanentDelete(args: {
    ownerId: Types.ObjectId;
    itemId: Types.ObjectId;
    // inject qua service: storageObjects.permanentDelete, quota.releaseUsed
  }): Promise<void> {
    const item = await this.model.findOne({ _id: args.itemId, ownerId: args.ownerId });
    if (!item) throw new NotFoundException('DRIVE_ITEM_NOT_FOUND');
    if (!item.isTrashed) {
      // Chỉ cho xoá cứng item đã ở trong Trash. Ép qua Trash trước.
      throw new BadRequestException('MUST_TRASH_BEFORE_PERMANENT_DELETE');
    }

    // Thu thập toàn bộ item cần xoá (item + subtree nếu folder).
    // [BẠN HOÀN THIỆN]: bounded batch nếu subtree lớn (mục 19).
    const targets =
      item.type === DriveItemType.FOLDER
        ? await this.model
            .find({
              ownerId: args.ownerId,
              $or: [{ _id: item._id }, { ancestorIds: item._id }],
            })
            .lean()
        : [item.toObject()];

    for (const t of targets) {
      // 1) Xoá object vật lý trên MinIO (idempotent) NẾU là file active.
      if (t.type === DriveItemType.FILE && t.storageObjectId) {
        // await this.storageObjects.permanentDelete(t.storageObjectId);
        // await this.quota.releaseUsed(t.ownerId, t.sizeBytes ?? 0n, `del:${t._id}`, t._id);
      }
      // 2) Dọn các document tham chiếu itemId ở collection khác (RẤT QUAN TRỌNG,
      //    tránh rác mồ côi — đúng lỗ hổng đã audit):
      //    - drive_permissions.deleteMany({ itemId: t._id })
      //    - share_links.deleteMany({ itemId: t._id })
      //    - user_item_states.deleteMany({ itemId: t._id })
      //    - (item_activities: giữ lại nếu muốn lịch sử, hoặc dọn)
      // 3) Xoá metadata drive_items.
    }

    await this.model.deleteMany({
      ownerId: args.ownerId,
      $or: [{ _id: item._id }, { ancestorIds: item._id }],
    });
    // TODO: nếu MinIO delete fail giữa chừng -> storage_object ở state delete_failed,
    // worker retry. KHÔNG được báo thành công nếu byte còn rò rỉ.
  }

  // ============================================================
  // G. LIST folder (cursor pagination, KHÔNG dùng skip)
  // ============================================================
  async listFolder(args: {
    ownerId: Types.ObjectId;
    parentId: Types.ObjectId | null;
    cursor?: { lastModifiedAt: Date; id: Types.ObjectId } | null;
    limit: number;
  }): Promise<DriveItemDoc[]> {
    const filter: any = {
      ownerId: args.ownerId,
      parentId: args.parentId,
      isTrashed: false,
    };
    if (args.cursor) {
      // Cursor keyset trên (lastModifiedAt desc, _id desc).
      filter.$or = [
        { lastModifiedAt: { $lt: args.cursor.lastModifiedAt } },
        {
          lastModifiedAt: args.cursor.lastModifiedAt,
          _id: { $lt: args.cursor.id },
        },
      ];
    }
    return this.model
      .find(filter)
      .sort({ lastModifiedAt: -1, _id: -1 })
      .limit(args.limit)
      .lean();
  }
}
```

---

## 5. Mapper — DriveItemDoc → DriveItemResponse

Đảm bảo KHÔNG lộ `normalizedName`, `_id` thô, `storageObjectId`, `ancestorIds`.

```ts
// modules/drive-items/mappers/drive-item.mapper.ts
import { DriveItemDoc } from '../schemas/drive-item.schema';
import { DriveItemResponse } from '../interfaces/drive-item.interface'; // type của bạn

export function toDriveItemResponse(doc: DriveItemDoc): DriveItemResponse {
  return {
    id: doc._id.toString(),
    ownerId: doc.ownerId.toString(),
    parentId: doc.parentId ? doc.parentId.toString() : null,
    name: doc.name,
    type: doc.type,
    fileStatus: doc.fileStatus,
    mimeType: doc.mimeType,
    // Int64 -> string để không mất precision (đúng quy ước schema mục 1.3).
    sizeBytes: doc.sizeBytes != null ? doc.sizeBytes.toString() : null,
    extension: doc.extension,
    childCount: doc.childCount,
    isTrashed: doc.isTrashed,
    trashedAt: doc.trashedAt ? doc.trashedAt.toISOString() : null,
    metadataVersion: doc.metadataVersion,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    lastModifiedAt: doc.lastModifiedAt.toISOString(),
  };
}
```

---

## 6. Permission — share cho user cụ thể + public link

Bạn đã có auth. Phần này thêm phân quyền. Hai cơ chế độc lập, bật cái nào tuỳ nhu cầu:

- `drive_permissions`: chia sẻ cho **user cụ thể** (viewer/editor).
- `share_links`: **link công khai** (ai có link đều xem/tải).

Kế thừa quyền dùng `ancestorIds`: share 1 folder ⇒ mọi item bên trong kế thừa, KHÔNG copy
permission xuống từng descendant.

### 6.1. Schema `drive_permissions`

```ts
// modules/permissions/schemas/drive-permission.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum PermissionRole {
  VIEWER = 'viewer',
  EDITOR = 'editor', // rename/move/organize/share metadata — KHÔNG phải sửa nội dung file
}

@Schema({ collection: 'drive_permissions', versionKey: false })
export class DrivePermissionDoc extends Document {
  declare _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  itemId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  granteeUserId: Types.ObjectId;

  @Prop({ type: String, enum: PermissionRole, required: true })
  role: PermissionRole;

  @Prop({ type: Boolean, required: true, default: true })
  canDownload: boolean;

  @Prop({ type: Types.ObjectId, required: true })
  createdById: Types.ObjectId;

  @Prop({ type: Date, default: null })
  revokedAt: Date | null;

  @Prop({ type: Number, required: true, default: 1 })
  metadataVersion: number;

  createdAt: Date;
  updatedAt: Date;
}

export const DrivePermissionSchema = SchemaFactory.createForClass(DrivePermissionDoc);
DrivePermissionSchema.set('timestamps', true);

// Một grantee chỉ có 1 permission còn hiệu lực trên 1 item.
DrivePermissionSchema.index(
  { itemId: 1, granteeUserId: 1 },
  { unique: true, partialFilterExpression: { revokedAt: null } },
);
// "Được chia sẻ với tôi".
DrivePermissionSchema.index({ granteeUserId: 1, revokedAt: 1, updatedAt: -1, _id: -1 });
DrivePermissionSchema.index({ itemId: 1, revokedAt: 1 });
```

### 6.2. Schema `share_links`

```ts
// modules/permissions/schemas/share-link.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'share_links', versionKey: false })
export class ShareLinkDoc extends Document {
  declare _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  itemId: Types.ObjectId;

  // Chỉ lưu SHA-256 của token, KHÔNG lưu token thô.
  @Prop({ type: Buffer, required: true })
  tokenHash: Buffer;

  @Prop({ type: Boolean, required: true, default: true })
  canDownload: boolean;

  @Prop({ type: String, default: null }) // Argon2/bcrypt nếu link có mật khẩu
  passwordHash: string | null;

  @Prop({ type: Date, default: null })
  expiresAt: Date | null;

  @Prop({ type: Date, default: null })
  revokedAt: Date | null;

  @Prop({ type: Types.ObjectId, required: true })
  createdById: Types.ObjectId;

  createdAt: Date;
}

export const ShareLinkSchema = SchemaFactory.createForClass(ShareLinkDoc);
ShareLinkSchema.set('timestamps', { createdAt: true, updatedAt: false });

ShareLinkSchema.index({ tokenHash: 1 }, { unique: true });
ShareLinkSchema.index({ itemId: 1, revokedAt: 1 });
ShareLinkSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { expiresAt: { $type: 'date' } } },
);
```

### 6.3. PermissionService — check quyền hiệu lực (kế thừa)

```ts
// modules/permissions/permission.service.ts
import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DrivePermissionDoc, PermissionRole } from './schemas/drive-permission.schema';
import { DriveItemDoc } from '../drive-items/schemas/drive-item.schema';

export enum AccessLevel {
  NONE = 'none',
  VIEW = 'view',
  EDIT = 'edit',
  OWNER = 'owner',
}

@Injectable()
export class PermissionService {
  constructor(
    @InjectModel(DrivePermissionDoc.name)
    private readonly permModel: Model<DrivePermissionDoc>,
    @InjectModel(DriveItemDoc.name)
    private readonly itemModel: Model<DriveItemDoc>,
  ) {}

  // Quyền hiệu lực của user trên 1 item = quyền trực tiếp HOẶC kế thừa từ ancestor.
  async resolveAccess(
    userId: Types.ObjectId,
    itemId: Types.ObjectId,
  ): Promise<AccessLevel> {
    const item = await this.itemModel.findById(itemId).lean();
    if (!item) return AccessLevel.NONE;

    // 1) Owner luôn full quyền.
    if (item.ownerId.equals(userId)) return AccessLevel.OWNER;

    // 2) Tìm permission trên chính item HOẶC bất kỳ ancestor nào (kế thừa).
    //    candidateIds = [itemId, ...ancestorIds]
    const candidateIds = [item._id, ...item.ancestorIds];
    const perms = await this.permModel
      .find({
        itemId: { $in: candidateIds },
        granteeUserId: userId,
        revokedAt: null,
      })
      .lean();

    if (perms.length === 0) return AccessLevel.NONE;

    // Lấy quyền cao nhất trong các permission áp dụng.
    const hasEditor = perms.some((p) => p.role === PermissionRole.EDITOR);
    return hasEditor ? AccessLevel.EDIT : AccessLevel.VIEW;
  }

  // Guard tiện dụng cho service khác gọi.
  async assertCanView(userId: Types.ObjectId, itemId: Types.ObjectId) {
    const lvl = await this.resolveAccess(userId, itemId);
    if (lvl === AccessLevel.NONE) throw new ForbiddenException('NO_ACCESS');
    return lvl;
  }

  async assertCanEdit(userId: Types.ObjectId, itemId: Types.ObjectId) {
    const lvl = await this.resolveAccess(userId, itemId);
    if (lvl !== AccessLevel.EDIT && lvl !== AccessLevel.OWNER) {
      throw new ForbiddenException('NO_EDIT_ACCESS');
    }
    return lvl;
  }

  // ---- Grant / revoke share cho user cụ thể ----
  async share(args: {
    actorId: Types.ObjectId;
    itemId: Types.ObjectId;
    granteeUserId: Types.ObjectId;
    role: PermissionRole;
    canDownload?: boolean;
  }): Promise<void> {
    // Chỉ owner/editor mới được share (tuỳ policy). [BẠN HOÀN THIỆN]
    await this.assertCanEdit(args.actorId, args.itemId);
    // Upsert: nếu đã có permission bị revoke -> reactivate.
    await this.permModel.updateOne(
      { itemId: args.itemId, granteeUserId: args.granteeUserId, revokedAt: null },
      {
        $set: { role: args.role, canDownload: args.canDownload ?? true },
        $setOnInsert: { createdById: args.actorId },
        $inc: { metadataVersion: 1 },
      },
      { upsert: true },
    );
  }

  async revoke(actorId: Types.ObjectId, itemId: Types.ObjectId, granteeUserId: Types.ObjectId) {
    await this.assertCanEdit(actorId, itemId);
    await this.permModel.updateOne(
      { itemId, granteeUserId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }
}
```

### 6.4. Public share-link — tạo & giải quyết

```ts
// modules/permissions/share-link.service.ts (khung rút gọn)
import * as crypto from 'crypto';

// Tạo link: sinh token ngẫu nhiên, lưu HASH, trả token thô CHỈ MỘT LẦN cho client.
async createShareLink(actorId, itemId, opts) {
  // await assertCanEdit(actorId, itemId)
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest(); // Buffer(32)
  // await shareLinkModel.create({ itemId, tokenHash, canDownload, passwordHash?, expiresAt?, createdById: actorId })
  return { url: `https://app.yourdrive.com/s/${rawToken}` }; // token thô không lưu lại
}

// Giải quyết link công khai: hash token nhận được rồi tra.
async resolveShareLink(rawToken, password?) {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest();
  // const link = await shareLinkModel.findOne({ tokenHash, revokedAt: null });
  // Revoked / expired / unknown -> TRẢ CÙNG một lỗi public để tránh lộ sự tồn tại.
  // if (!link || (link.expiresAt && link.expiresAt < now)) throw new NotFoundException('LINK_UNAVAILABLE');
  // if (link.passwordHash) verify(password, link.passwordHash)
  // return { itemId: link.itemId, canDownload: link.canDownload };
}
```

---

## 7. Preview / Download flow

```
Authorize (owner | permission kế thừa | share-link hợp lệ)
  -> load drive_item, yêu cầu type=file & fileStatus=active
  -> load storage_object (state=active)
  -> (nếu bật scan) yêu cầu scanStatus=clean
  -> trả PRESIGNED GET URL ngắn hạn của MinIO  (KHÔNG lộ bucket/objectKey)
```

```ts
// modules/previews/preview.service.ts (khung)
async getDownloadUrl(userId, itemId) {
  await this.permission.assertCanView(userId, itemId);            // owner/viewer/editor
  const item = await this.driveItems.findFileActive(itemId);      // ném lỗi nếu chưa active
  const url = await this.storageObjects.getPresignedDownloadUrl(
    item.storageObjectId, item.ownerId,
  );
  return { url, expiresInSeconds: 3600 };
}
```

Range/streaming: presigned GET của MinIO hỗ trợ HTTP Range sẵn, browser tự xử lý cho
video/pdf preview. Nếu muốn giấu hẳn MinIO, có thể stream proxy qua endpoint có `Range`,
nhưng tốn băng thông server — chỉ dùng khi bắt buộc.

---

## 8. childCount (approximate) — cập nhật coalesced

`childCount` là gợi ý hiển thị, KHÔNG cần chính xác tuyệt đối (schema mục 24 "hot parent").

- Khi thêm/bớt child: `$inc` childCount của parent — chấp nhận sai lệch tạm thời.
- Job định kỳ reconcile: đếm lại `count({ parentId, isTrashed:false })` cho folder nóng.
- KHÔNG để childCount chặn thao tác chính; sai số nhỏ là chấp nhận được.

---

## 9. Bảng chi phí thao tác (tự kiểm khi thiết kế query)

| Thao tác | Query shape | Chi phí |
|---|---|---|
| Get item | `_id + ownerId` | Point lookup |
| List folder | index equality prefix + cursor | Bounded theo page |
| Breadcrumb | đọc ancestorIds + 1 `$in` | O(depth), depth bounded |
| Rename / move file | 1 document | Constant |
| Move folder | root + rewrite ancestorIds descendant | O(subtree) — cần ngưỡng sync |
| Trash/restore folder | root + subtree | O(subtree) — cần ngưỡng sync |
| Permanent delete folder | subtree + xoá MinIO + cleanup refs | O(subtree), bounded batch |
| Preview/download | item lookup + storage lookup | 2 point reads |
| Resolve permission | 1 item + 1 `$in` trên (item+ancestors) | O(depth) |

---

## 10. Thứ tự làm gợi ý

1. Enums + schema `drive_items`, `storage_objects` + indexes.
2. `DriveItemsService`: createFolder, createPlaceholder/activateFile/markFailed, list, rename.
3. `MimeDetectorService` (mục 3b) + `getObjectRange` trong adapter → detect MIME/extension
   chuẩn khi finalize. Nối `storage_objects` + upload service (đã có) → upload end-to-end.
4. Move (file trước, folder sau với ngưỡng sync + rewrite ancestorIds).
5. Trash / restore (thêm `trashedRootId` để restore đúng phạm vi).
6. Permanent delete (xoá MinIO idempotent + cleanup drive_permissions/share_links/user_item_states).
7. Permission: drive_permissions + PermissionService (resolveAccess kế thừa).
8. Public share-link (tokenHash, cùng-lỗi cho revoked/expired/unknown).
9. Preview/download (presigned GET + authorize).
10. childCount reconcile job + benchmark subtree lớn trước khi thêm worker async.

---

## 11. Những điểm dễ sai — kiểm trước khi lên production

- **Move folder / trash folder / permanent delete** là O(subtree): PHẢI có ngưỡng đồng bộ,
  vượt thì từ chối hoặc đẩy worker. Đừng chạy vòng lặp subtree không giới hạn trong 1 transaction.
- **Permanent delete phải cleanup document tham chiếu** (drive_permissions, share_links,
  user_item_states) — nếu không sẽ tích rác mồ côi (lỗ hổng đã audit từ đầu).
- **Restore va chạm tên**: unique index chỉ tính `isTrashed=false`, nên khi restore có thể
  đụng tên item active — bắt lỗi 11000 và xử lý (đổi tên/hỏi user).
- **`trashedRootId`**: nên thêm field này để phân biệt "item bị trash do folder cha" vs
  "item tự bị trash" → restore đúng phạm vi, không vô tình khôi phục thứ user đã xoá riêng.
- **Không bao giờ xoá byte MinIO khi trash** — chỉ xoá khi permanent delete.
- **Presigned URL hết hạn**: preview URL sống ~1h, client cần xin lại khi hết.
- **BigInt sizeBytes**: kiểm chứng lưu/đọc trên phiên bản Mongoose của bạn (như guide quota).