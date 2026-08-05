# Hướng dẫn triển khai Upload — Phần A (Quota atomic) & Phần B (Uppy client)

Tài liệu này là **khung có chủ đích để lại chỗ trống** cho bạn tự hoàn thiện.
Các đoạn `// TODO:` và `// [BẠN HOÀN THIỆN]` là nơi cần bạn điền logic thật.
Phần khung, chữ ký hàm, và các điểm dễ sai đã được viết sẵn kèm giải thích.

Ngữ cảnh: MinIO (S3-compatible, đã bật CORS), metadata ở MongoDB, byte đi thẳng
lên MinIO qua presigned URL, không virus-scan. Service upload đã có sẵn 4 route
`init / status / complete / abort` + reaper cron.

---

## PHẦN A — QuotaPort atomic với Mongoose

### A.0. Vì sao phải atomic

Sai lầm kinh điển: đọc counter rồi mới ghi trong 2 bước.

```ts
// ❌ SAI — race condition: 2 request cùng đọc thấy còn chỗ, cùng ghi -> vượt quota
const acc = await model.findOne({ userId });
if (acc.usedBytes + acc.reservedBytes + bytes <= acc.quotaBytes) {
  await model.updateOne({ userId }, { $inc: { reservedBytes: bytes } });
}
```

Đúng: gộp **điều kiện + ghi vào một lệnh `findOneAndUpdate`** duy nhất. MongoDB đảm bảo
atomic ở mức 1 document. Điều kiện kiểm tra "còn đủ chỗ" đặt trong `filter`, phép cộng
đặt trong `$inc`. Nếu không đủ chỗ, `filter` không khớp -> trả `null` -> ném lỗi quota.

### A.1. Ràng buộc bất biến cần giữ (theo schema mục 11)

```
quotaBytes    >= 0
usedBytes     >= 0
reservedBytes >= 0
usedBytes + reservedBytes <= quotaBytes
```

### A.2. Ghi chú kiểu dữ liệu byte

`quotaBytes / usedBytes / reservedBytes` là **Int64** trong Mongo (`bigint` trong TS).
Không dùng `number` cho các field này vì tổng dung lượng có thể vượt 2^53.

- Trong Mongoose schema, khai báo type là `BigInt` (Mongoose hỗ trợ từ v6.11+),
  hoặc lưu dạng `Long` qua `mongodb.Long` nếu bản Mongoose của bạn chưa hỗ trợ tốt.
- `$inc` với BigInt: kiểm tra kỹ bản Mongoose của bạn có cho `$inc` bằng `bigint`
  hay không. Nếu chưa, chuyển sang `Long` (xem TODO trong code).

### A.3. Schema `quota_accounts`

```ts
// quota-account.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'quota_accounts', versionKey: false })
export class QuotaAccount extends Document {
  declare _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, unique: true })
  userId: Types.ObjectId;

  // TODO: chọn cách lưu Int64. Hai lựa chọn:
  //   (1) type: BigInt  -> đơn giản nếu Mongoose bản bạn hỗ trợ tốt $inc bigint
  //   (2) type: mongoose.Schema.Types.Long (cần plugin mongoose-long) -> an toàn hơn
  // Ở khung này minh hoạ bằng BigInt. Đổi nếu môi trường của bạn không hợp.
  @Prop({ type: BigInt, required: true })
  quotaBytes: bigint;

  @Prop({ type: BigInt, required: true, default: 0n })
  usedBytes: bigint;

  @Prop({ type: BigInt, required: true, default: 0n })
  reservedBytes: bigint;

  updatedAt: Date;
}

export const QuotaAccountSchema = SchemaFactory.createForClass(QuotaAccount);
QuotaAccountSchema.set('timestamps', { createdAt: false, updatedAt: true });
QuotaAccountSchema.index({ userId: 1 }, { unique: true });
```

### A.4. Ledger `quota_transactions` (idempotency)

Mỗi thao tác quota ghi 1 dòng ledger với `idempotencyKey` unique. Nếu cùng key gọi lại
(retry), việc ghi ledger sẽ đụng unique index -> ta bắt lỗi duplicate và coi như đã xử lý,
KHÔNG cộng/trừ counter lần hai. Đây là cách chống double-count khi client retry.

```ts
// quota-transaction.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum QuotaTxType {
  RESERVE = 'reserve',
  COMMIT = 'commit',
  RELEASE = 'release',
  DELETE = 'delete',
}

@Schema({ collection: 'quota_transactions', versionKey: false })
export class QuotaTransaction extends Document {
  declare _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, default: null })
  uploadSessionId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, default: null })
  driveItemId: Types.ObjectId | null;

  @Prop({ type: String, enum: QuotaTxType, required: true })
  type: QuotaTxType;

  @Prop({ type: BigInt, required: true })
  bytes: bigint;

  @Prop({ type: String, required: true, unique: true })
  idempotencyKey: string;

  createdAt: Date;
}

export const QuotaTransactionSchema =
  SchemaFactory.createForClass(QuotaTransaction);
QuotaTransactionSchema.set('timestamps', { createdAt: true, updatedAt: false });
QuotaTransactionSchema.index({ idempotencyKey: 1 }, { unique: true });
QuotaTransactionSchema.index({ userId: 1, createdAt: -1, _id: -1 });
```

### A.5. QuotaService — hiện thực QuotaPort

```ts
// quota.service.ts
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { QuotaAccount } from './quota-account.schema';
import { QuotaTransaction, QuotaTxType } from './quota-transaction.schema';

// Lỗi domain riêng để service upload phân biệt "hết quota" với lỗi khác
export class QuotaExceededError extends ForbiddenException {
  constructor() {
    super('QUOTA_EXCEEDED');
  }
}

@Injectable()
export class QuotaService {
  constructor(
    @InjectModel(QuotaAccount.name)
    private readonly accountModel: Model<QuotaAccount>,
    @InjectModel(QuotaTransaction.name)
    private readonly txModel: Model<QuotaTransaction>,
  ) {}

  // -------------------------------------------------------------------
  // Helper: ghi ledger idempotent. Trả về true nếu đây là lần đầu (cần
  // áp dụng thay đổi counter), false nếu key đã tồn tại (bỏ qua, đã xử lý).
  // -------------------------------------------------------------------
  private async recordLedgerOnce(
    userId: Types.ObjectId,
    type: QuotaTxType,
    bytes: bigint,
    idempotencyKey: string,
    refs: { uploadSessionId?: Types.ObjectId; driveItemId?: Types.ObjectId },
    session?: ClientSession,
  ): Promise<boolean> {
    try {
      await this.txModel.create(
        [
          {
            userId,
            type,
            bytes,
            idempotencyKey,
            uploadSessionId: refs.uploadSessionId ?? null,
            driveItemId: refs.driveItemId ?? null,
          },
        ],
        { session },
      );
      return true;
    } catch (err: any) {
      // 11000 = duplicate key -> key đã dùng -> thao tác đã xảy ra trước đó
      if (err?.code === 11000) return false;
      throw err;
    }
  }

  // -------------------------------------------------------------------
  // RESERVE — trước khi cho upload. Atomic: chỉ tăng reservedBytes NẾU
  // vẫn còn đủ chỗ. Điều kiện nằm trong filter bằng $expr.
  // -------------------------------------------------------------------
  async reserve(
    userId: Types.ObjectId,
    bytes: bigint,
    idempotencyKey: string,
  ): Promise<void> {
    // Bước 1: chốt idempotency. Nếu key đã có, coi như reserve đã làm rồi -> return.
    const isFirst = await this.recordLedgerOnce(
      userId,
      QuotaTxType.RESERVE,
      bytes,
      idempotencyKey,
      {},
    );
    if (!isFirst) return;

    // Bước 2: atomic conditional update.
    // filter khớp CHỈ KHI used + reserved + bytes <= quota.
    const updated = await this.accountModel.findOneAndUpdate(
      {
        userId,
        // TODO: $expr với BigInt — kiểm tra driver của bạn so sánh BigInt đúng chưa.
        // Nếu lưu bằng Long thay vì BigInt, cú pháp $add/$lte vẫn hoạt động.
        $expr: {
          $lte: [
            { $add: ['$usedBytes', '$reservedBytes', bytes] },
            '$quotaBytes',
          ],
        },
      },
      { $inc: { reservedBytes: bytes } },
      { new: true },
    );

    if (!updated) {
      // Không khớp filter = hết chỗ HOẶC account không tồn tại.
      // Rollback ledger để cùng key có thể thử lại sau khi user dọn chỗ.
      // [BẠN HOÀN THIỆN]: cân nhắc có nên xoá ledger reserve thất bại không.
      //   - Nếu muốn cho retry cùng key: xoá dòng ledger vừa tạo.
      //   - Nếu muốn key là "một lần": giữ nguyên, client phải đổi key.
      await this.txModel.deleteOne({ idempotencyKey }).catch(() => {});

      const exists = await this.accountModel.exists({ userId });
      if (!exists) throw new NotFoundException('QUOTA_ACCOUNT_NOT_FOUND');
      throw new QuotaExceededError();
    }
  }

  // -------------------------------------------------------------------
  // COMMIT — khi upload xong: chuyển reserved -> used.
  // reservedBytes -= bytes; usedBytes += bytes  (tổng không đổi)
  // -------------------------------------------------------------------
  async commit(
    userId: Types.ObjectId,
    bytes: bigint,
    idempotencyKey: string,
    refs: { uploadSessionId?: Types.ObjectId; driveItemId?: Types.ObjectId } = {},
  ): Promise<void> {
    const isFirst = await this.recordLedgerOnce(
      userId,
      QuotaTxType.COMMIT,
      bytes,
      idempotencyKey,
      refs,
    );
    if (!isFirst) return;

    // Guard: reservedBytes phải >= bytes để không âm.
    const updated = await this.accountModel.findOneAndUpdate(
      {
        userId,
        $expr: { $gte: ['$reservedBytes', bytes] },
      },
      {
        $inc: {
          reservedBytes: -bytes,
          usedBytes: bytes,
        },
      },
      { new: true },
    );

    if (!updated) {
      // [BẠN HOÀN THIỆN]: reserved < bytes là bất thường (reserve bị mất/không khớp).
      // Quyết định: ném lỗi để điều tra, hay tự sửa (reconcile). Khung này ném lỗi.
      await this.txModel.deleteOne({ idempotencyKey }).catch(() => {});
      throw new ConflictException('QUOTA_COMMIT_INCONSISTENT');
    }
  }

  // -------------------------------------------------------------------
  // RELEASE — huỷ/hết hạn upload: trả lại reserved chưa commit.
  // reservedBytes -= bytes
  // -------------------------------------------------------------------
  async release(
    userId: Types.ObjectId,
    bytes: bigint,
    idempotencyKey: string,
  ): Promise<void> {
    const isFirst = await this.recordLedgerOnce(
      userId,
      QuotaTxType.RELEASE,
      bytes,
      idempotencyKey,
      {},
    );
    if (!isFirst) return;

    // $max để reservedBytes không tụt xuống âm nếu có sai lệch.
    await this.accountModel.updateOne({ userId }, [
      {
        $set: {
          reservedBytes: {
            // TODO: cú pháp aggregation pipeline update. Với Long/BigInt,
            // $subtract và $max hoạt động. Kiểm tra lại với dữ liệu thật.
            $max: [0, { $subtract: ['$reservedBytes', bytes] }],
          },
        },
      },
    ]);
  }

  // -------------------------------------------------------------------
  // DELETE — khi xoá vĩnh viễn file đã active: giảm usedBytes.
  // usedBytes -= bytes
  // -------------------------------------------------------------------
  async releaseUsed(
    userId: Types.ObjectId,
    bytes: bigint,
    idempotencyKey: string,
    driveItemId?: Types.ObjectId,
  ): Promise<void> {
    const isFirst = await this.recordLedgerOnce(
      userId,
      QuotaTxType.DELETE,
      bytes,
      idempotencyKey,
      { driveItemId },
    );
    if (!isFirst) return;

    await this.accountModel.updateOne({ userId }, [
      {
        $set: {
          usedBytes: { $max: [0, { $subtract: ['$usedBytes', bytes] }] },
        },
      },
    ]);
  }

  // -------------------------------------------------------------------
  // Khởi tạo account khi tạo user mới.
  // -------------------------------------------------------------------
  async createAccount(userId: Types.ObjectId, quotaBytes: bigint): Promise<void> {
    await this.accountModel.updateOne(
      { userId },
      {
        $setOnInsert: {
          quotaBytes,
          usedBytes: 0n,
          reservedBytes: 0n,
        },
      },
      { upsert: true },
    );
  }
}
```

### A.6. Điểm bạn cần tự quyết / kiểm chứng (phần A)

1. **BigInt vs Long trong Mongoose** — chạy thử `$inc` và `$expr` với BigInt trên đúng
   phiên bản Mongoose của bạn. Nếu gặp lỗi serialize, chuyển sang `mongoose-long`.
2. **Chính sách idempotencyKey khi reserve thất bại** — cho retry cùng key hay bắt đổi key.
3. **Transaction bao quanh commit** — nếu muốn commit quota + activate drive_item + tạo
   storage_object nằm trong 1 transaction, truyền `ClientSession` xuyên suốt (replica set
   cho phép). Khung này để tách rời; cân nhắc gộp nếu cần tính nhất quán mạnh hơn.
4. **Reconcile job** — viết job định kỳ so `usedBytes` với tổng `sizeBytes` các file còn
   active (kể cả trong Trash) để phát hiện drift (schema mục 12).

---

## PHẦN B — Uppy client trỏ vào 4 endpoint

### B.0. Vì sao Uppy + AWS S3 Multipart

Uppy có plugin `@uppy/aws-s3` (bản mới gộp cả multipart) lo trọn: chunk, upload song song,
retry, resume sau mất mạng, tính part số. Bạn chỉ cần cung cấp các **callback** để Uppy
biết gọi endpoint nào của bạn để lấy presigned URL. Byte đi thẳng browser -> MinIO.

### B.1. Cài đặt

```bash
npm install @uppy/core @uppy/dashboard @uppy/aws-s3
# (tuỳ chọn UI) @uppy/drag-drop @uppy/progress-bar
```

### B.2. Hợp đồng API mà client kỳ vọng từ server

Đảm bảo 4 endpoint server trả đúng shape dưới đây (khớp service đã có):

```
POST /uploads
  body:  { name, parentId, declaredSizeBytes, idempotencyKey }
  resp (single):    { uploadSessionId, method: "single", putUrl, expiresAt }
  resp (multipart): { uploadSessionId, method: "multipart",
                      partSizeBytes, expectedPartsCount,
                      partUrls: [{ partNumber, url }], expiresAt }

GET  /uploads/:id/status
  resp: { status, totalParts, uploadedParts,
          missingPartUrls: [{ partNumber, url }] }

POST /uploads/:id/complete
  body:  { parts: [{ partNumber, etag, sizeBytes }] }   // multipart
         (single: body rỗng)
  resp:  { driveItemId, status }

POST /uploads/:id/abort
  resp:  { status }
```

### B.3. Cấu hình Uppy (khung TypeScript, ví dụ React/Vanilla đều dùng được)

```ts
// upload-client.ts
import Uppy from '@uppy/core';
import AwsS3 from '@uppy/aws-s3';

// [BẠN HOÀN THIỆN]: hàm gọi API của bạn (gắn token auth vào header).
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      // TODO: Authorization: `Bearer ${getAccessToken()}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    // TODO: parse lỗi domain (QUOTA_EXCEEDED, ...) và hiển thị cho user
    throw new Error(`API ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function createUppy() {
  const uppy = new Uppy({
    autoProceed: false,
    restrictions: {
      // TODO: đặt giới hạn hợp lý cho Drive clone của bạn
      maxFileSize: 5 * 1024 * 1024 * 1024 * 200, // ví dụ trần rất lớn
      maxNumberOfFiles: 20,
    },
  });

  uppy.use(AwsS3, {
    // Bật đường multipart. Uppy sẽ tự quyết chunk dựa trên size + các callback dưới.
    shouldUseMultipart: (file) => {
      // Khớp ngưỡng server: >= 8MB thì multipart.
      // (Server vẫn là nơi quyết định cuối; đây chỉ để Uppy chọn code path.)
      return (file.size ?? 0) >= 8 * 1024 * 1024;
    },

    // -------- Đường SINGLE (file nhỏ) --------
    // Uppy gọi hàm này khi shouldUseMultipart trả false.
    getUploadParameters: async (file) => {
      const init = await api<{
        uploadSessionId: string;
        method: 'single';
        putUrl: string;
      }>('/uploads', {
        method: 'POST',
        body: JSON.stringify({
          name: file.name,
          parentId: (file.meta as any).parentId ?? null,
          declaredSizeBytes: String(file.size ?? 0),
          idempotencyKey: crypto.randomUUID(),
        }),
      });

      // Lưu sessionId để dùng ở bước complete.
      file.meta.uploadSessionId = init.uploadSessionId;

      return {
        method: 'PUT',
        url: init.putUrl,
        // MinIO presigned PUT không cần thêm field form.
        fields: {},
        headers: {
          // TODO: nếu presigned URL của bạn ký kèm Content-Type,
          // phải set đúng header ở đây, nếu không MinIO trả 403.
          'Content-Type': file.type || 'application/octet-stream',
        },
      };
    },

    // -------- Đường MULTIPART (file vừa/nặng) --------

    // 1) Khởi tạo: gọi POST /uploads, server tạo session + trả partUrls.
    createMultipartUpload: async (file) => {
      const init = await api<{
        uploadSessionId: string;
        method: 'multipart';
        partUrls: { partNumber: number; url: string }[];
      }>('/uploads', {
        method: 'POST',
        body: JSON.stringify({
          name: file.name,
          parentId: (file.meta as any).parentId ?? null,
          declaredSizeBytes: String(file.size ?? 0),
          idempotencyKey: crypto.randomUUID(),
        }),
      });

      file.meta.uploadSessionId = init.uploadSessionId;
      // [BẠN HOÀN THIỆN]: cache partUrls vào file.meta để signPart lấy ra,
      // tránh gọi lại server cho từng part.
      (file.meta as any).partUrls = init.partUrls;

      // Uppy cần uploadId + key. Ta dùng uploadSessionId làm khoá logic.
      return {
        uploadId: init.uploadSessionId,
        key: init.uploadSessionId, // server tự map sang objectKey thật
      };
    },

    // 2) Uppy hỏi presigned URL cho từng part.
    signPart: async (file, { partNumber }) => {
      const cached: { partNumber: number; url: string }[] =
        (file.meta as any).partUrls ?? [];
      const hit = cached.find((p) => p.partNumber === partNumber);
      if (hit) return { url: hit.url };

      // Nếu không có trong cache (vd resume, URL cũ hết hạn):
      // gọi /status để xin URL mới cho part còn thiếu.
      const status = await api<{
        missingPartUrls: { partNumber: number; url: string }[];
      }>(`/uploads/${file.meta.uploadSessionId}/status`);

      const fresh = status.missingPartUrls.find(
        (p) => p.partNumber === partNumber,
      );
      if (!fresh) {
        // [BẠN HOÀN THIỆN]: part này đã upload rồi hoặc lỗi logic.
        throw new Error(`No presigned URL for part ${partNumber}`);
      }
      return { url: fresh.url };
    },

    // 3) RESUME: Uppy gọi để biết part nào đã lên (sau khi mất mạng có lại).
    //    Trả danh sách part đã có -> Uppy bỏ qua, chỉ upload phần thiếu.
    listParts: async (file) => {
      const status = await api<{
        // server cần trả thêm danh sách part ĐÃ upload cho resume chuẩn Uppy.
        // [BẠN HOÀN THIỆN Ở SERVER]: bổ sung field uploadedParts vào /status:
        //   uploadedParts: [{ partNumber, etag, sizeBytes }]
        uploadedParts?: { partNumber: number; etag: string; sizeBytes: number }[];
      }>(`/uploads/${file.meta.uploadSessionId}/status`);

      return (status.uploadedParts ?? []).map((p) => ({
        PartNumber: p.partNumber,
        ETag: p.etag,
        Size: p.sizeBytes,
      }));
    },

    // 4) Hoàn tất: gửi danh sách {partNumber, etag} lên server complete.
    completeMultipartUpload: async (file, { parts }) => {
      const resp = await api<{ driveItemId: string; status: string }>(
        `/uploads/${file.meta.uploadSessionId}/complete`,
        {
          method: 'POST',
          body: JSON.stringify({
            parts: parts.map((p) => ({
              partNumber: p.PartNumber,
              etag: p.ETag,
              // [BẠN HOÀN THIỆN]: Uppy không luôn cấp Size ở đây.
              // Nếu server cần sizeBytes để verify tổng, hoặc:
              //   - server tự lấy size qua ListParts thay vì tin client, hoặc
              //   - bạn tự tính size mỗi part và đính vào.
              sizeBytes: String((p as any).Size ?? 0),
            })),
          }),
        },
      );
      file.meta.driveItemId = resp.driveItemId;
      // Uppy cần trả location; ta không expose URL thật -> trả rỗng/placeholder.
      return { location: '' };
    },

    // 5) Huỷ (user bấm cancel): gọi abort để server dọn multipart + release quota.
    abortMultipartUpload: async (file) => {
      await api(`/uploads/${file.meta.uploadSessionId}/abort`, {
        method: 'POST',
      });
    },
  });

  return uppy;
}
```

### B.4. Gắn UI (ví dụ tối giản)

```ts
// [BẠN HOÀN THIỆN]: gắn Dashboard hoặc UI của riêng bạn.
import Dashboard from '@uppy/dashboard';
import '@uppy/core/dist/style.min.css';
import '@uppy/dashboard/dist/style.min.css';

const uppy = createUppy();
uppy.use(Dashboard, { inline: true, target: '#uppy' });

// Gắn parentId (thư mục đích) vào từng file trước khi upload:
uppy.on('file-added', (file) => {
  uppy.setFileMeta(file.id, {
    parentId: getCurrentFolderId(), // TODO: lấy folder đang mở
  });
});

uppy.on('complete', (result) => {
  // TODO: refresh danh sách file trong folder hiện tại
  console.log('Uploaded:', result.successful.map((f) => f.meta.driveItemId));
});
```

### B.5. Điểm cần bổ sung Ở SERVER để Uppy resume chuẩn (phần B)

Uppy `listParts` cần server trả danh sách part **đã** upload (kèm ETag). Service hiện tại
`/status` mới trả `missingPartUrls`. Cần bổ sung:

```ts
// Trong UploadsService.getStatus (nhánh multipart), thêm vào response:
//   uploadedParts: remoteParts.map(p => ({
//     partNumber: p.partNumber,
//     etag: p.etag,
//     sizeBytes: p.sizeBytes,
//   }))
// remoteParts lấy từ storage.listParts() đã có sẵn trong hàm.
```

### B.6. Checklist CORS trên MinIO (nếu không cấu hình, browser sẽ bị chặn)

```
- Cho phép origin của frontend (vd https://app.yourdrive.com)
- Cho phép method: PUT, GET, HEAD
- Cho phép header: Content-Type, và các header presigned ký kèm
- Expose header: ETag   <-- BẮT BUỘC. Không expose ETag thì Uppy không đọc được
                             ETag của part -> không complete được multipart.
```

Ví dụ CORS config (điều chỉnh origin cho đúng):

```json
[
  {
    "AllowedOrigins": ["https://app.yourdrive.com"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## Thứ tự làm gợi ý

1. Phần A: schema `quota_accounts` + `quota_transactions`, quyết BigInt/Long, viết
   `QuotaService`, test race bằng 100 request reserve đồng thời (đúng benchmark schema mục 24).
2. Nối `QuotaService` vào `UploadsService` (thay `QuotaPort` placeholder).
3. Phần B: bổ sung `uploadedParts` vào `/status`, cấu hình CORS MinIO (nhớ ExposeHeaders ETag).
4. Dựng Uppy client, test luồng: file nhỏ, file vừa, file nặng, và **rút mạng giữa chừng
   rồi nối lại** để xác nhận resume chỉ upload phần thiếu.
5. Test abort + reaper: bỏ dở upload, chờ hết hạn, xác nhận quota được release và không
   còn multipart rác trên MinIO.
