# File Central v2 – Kiến trúc & Thiết kế nghiệp vụ (bản soạn lại)

> Bản này thay thế bản phân tích ban đầu. Giữ nguyên các quyết định đúng (MinIO chỉ lưu binary, MongoDB quản lý toàn bộ nghiệp vụ, ancestor-chain cho folder share), đồng thời sửa các điểm chưa chuẩn (upload buffer RAM, thiếu refresh token, thiếu trash, thiếu pagination...) để tiệm cận hành vi thật của Google Drive.

---

## 1. Mục tiêu & phạm vi

Cho phép người dùng:

- Tạo thư mục, xây cây thư mục lồng nhau không giới hạn độ sâu.
- Upload file (kể cả file lớn) mà **không load toàn bộ vào RAM**.
- Tải file về, kể cả file được share.
- Chia sẻ file cho user/email cụ thể hoặc qua public link.
- Chia sẻ thư mục — mọi file/folder con bên trong tự động thừa hưởng quyền, không cần share thủ công từng item.
- Xoá vào thùng rác (trash), khôi phục lại, hoặc xoá vĩnh viễn.
- Xem trước file (preview) mà không cần tải về.
- Tìm kiếm có phân trang, lọc theo loại file.

Không nằm trong phạm vi MVP này: real-time collaboration, OCR/full-text search trong nội dung file, versioning nhiều bản, workspace nhóm.

---

## 2. Kiến trúc tổng quan (đã sửa)

```txt
Browser / Mobile
      │  HTTPS
      ▼
┌─────────────────────────────────────────┐
│              NestJS API                  │
│  ┌───────────┐  ┌───────────────────┐    │
│  │ Throttler │  │  JwtAuthGuard      │    │
│  │ Guard     │  │  (access token)    │    │
│  └───────────┘  └───────────────────┘    │
│              ▼                           │
│  Controller → Service → PermissionsService│
│              ▼                           │
│  ResponseInterceptor (map → DTO sạch)     │
└───────┬───────────────────────┬──────────┘
        │                       │
        ▼                       ▼
   MongoDB                   MinIO
 (metadata, permission,   (binary object,
  refresh token,           upload qua stream
  share, trash state)      KHÔNG buffer RAM)
```

Điểm khác biệt so với bản đầu:

1. **Upload đi qua disk-buffered stream**, không dùng `MemoryStorage` của Multer nữa (chi tiết mục 8.1).
2. **Có tầng Throttler** chặn brute-force trước khi tới `AuthController`.
3. **Có `ResponseInterceptor`** chuẩn hoá output, không lộ field nội bộ (`objectKey`, `bucket`, `__v`) ra client.
4. **JWT tách 2 loại token**: access token (ngắn hạn) + refresh token (lưu DB, revoke được).

---

## 3. Luồng nghiệp vụ chi tiết

### 3.1. Tạo thư mục

```txt
Client: POST /folders { name, parentId }
   │
   ▼
FoldersController
   │
   ▼
FoldersService.create
   ├─ DriveItemsService.assertValidParent(ownerId, parentId)
   │     → parent phải tồn tại, thuộc về user, type = folder, chưa xoá
   ├─ DriveItemsService.assertNoDuplicateName(ownerId, parentId, name)
   │     → (xem mục 8 để biết chính sách trùng tên đã đổi thế nào)
   └─ DriveItem.create({ type: 'folder', ownerId, parentId, name })
   │
   ▼
ResponseInterceptor → trả về FolderResponseDto
```

### 3.2. Upload file (đã sửa để không buffer RAM)

```txt
Client: POST /files/upload  (multipart/form-data, field "file" + "parentId")
   │
   ▼
FilesController
   │  Multer dùng DiskStorage → ghi file tạm vào /tmp/uploads/<uuid>
   │  (không giữ buffer trong RAM của Node process)
   ▼
FilesService.upload
   ├─ 1. assertValidParent + assertNoDuplicateName (fail fast, chưa đụng MinIO)
   ├─ 2. Mở read stream từ file tạm trên disk
   ├─ 3. minioService.putObjectStream(objectKey, readStream, size, mimeType)
   │        (MinIO SDK nhận readable stream, tự đọc theo chunk, không load hết vào RAM)
   ├─ 4. Nếu upload MinIO OK → tạo DriveItem trong MongoDB
   │        Nếu MongoDB lỗi → rollback: xoá object vừa tạo trên MinIO
   ├─ 5. finally: xoá file tạm ở /tmp dù thành công hay thất bại
   └─ 6. return DriveItem
```

**Vì sao đổi:** MVP ban đầu dùng `file.buffer` (Multer `MemoryStorage`) — với file 200MB, RAM của Node process tăng đột biến, nhiều upload đồng thời có thể làm sập server. Google Drive thật xử lý upload theo chunk/resumable; ở mức MVP ta chỉ cần đảm bảo **không giữ toàn bộ file trong RAM**, dùng disk tạm làm bộ đệm trung gian là đủ.

### 3.3. Tải file (download)

```txt
Client: GET /files/:id/download
   │
   ▼
FilesController
   │
   ▼
PermissionsService.requireAccess(userId, itemId, DOWNLOAD)
   ├─ Nếu là owner → pass
   ├─ Nếu không → lấy ancestor chain của item
   │        → tìm Share (trực tiếp hoặc trên ancestor) có permission >= download
   │        → không có → 403
   ▼
FilesService.getDownloadStream
   ├─ minioService.getObjectStream(objectKey)
   └─ res.pipe(stream)   → KHÔNG buffer, stream thẳng về client
```

### 3.4. Chia sẻ file

```txt
Client: POST /shares { itemId, shareType: "user" | "public_link", permission, sharedWithEmail? }
   │
   ▼
SharesService.create
   ├─ check current user là owner của itemId (bắt buộc, kể cả admin cũng không share hộ)
   ├─ nếu shareType = user:
   │      lookup email → nếu email đã có tài khoản, gắn sharedWithUserId luôn
   │      (giúp check quyền theo userId nhanh hơn là chỉ theo email)
   ├─ nếu shareType = public_link:
   │      generate token ngẫu nhiên (nanoid), lưu expiresAt nếu có
   └─ Share.create(...)
```

### 3.5. Chia sẻ thư mục (điểm khó nhất — giữ nguyên "Cách 1")

```txt
User A share folder "Documents" cho User B, permission = view
   │
   ▼
Chỉ 1 Share record được tạo: { itemId: Documents, sharedWithUserId: B, permission: view }
KHÔNG copy permission xuống từng file con bên trong Documents.

Khi User B mở /drive?parentId=Documents/cv.pdf (hoặc gọi
GET /shares/shared-with-me/:folderId/items để duyệt vào bên trong):
   │
   ▼
PermissionsService.getAncestorChain(cv.pdf)
   → [cv.pdf, Documents, ...các folder cha khác của Documents]
   │
   ▼
Tìm Share nào áp dụng cho BẤT KỲ id nào trong chain, thuộc về User B
   → tìm thấy Share trên "Documents" → cv.pdf được thừa hưởng quyền view
```

Ưu điểm: revoke 1 share là toàn bộ cây con mất quyền ngay lập tức, không cần dọn dẹp hàng loạt record con.
Đánh đổi: mỗi lần check quyền tốn thêm vài query để đi lên ancestor chain — chấp nhận được ở quy mô MVP, cần cache hoặc denormalize (lưu `path` array) nếu scale lớn hơn.

---

## 4. Module NestJS (cập nhật)

```txt
src/
├── auth/              # access token + refresh token, throttler cho login
│   └── schemas/refresh-token.schema.ts   [MỚI]
├── users/
├── drive-items/        # DriveItem schema + helper dùng chung
├── permissions/        # logic ancestor-chain (không đổi)
├── storage/
│   └── minio.service.ts   [SỬA: thêm putObjectStream]
├── folders/
├── files/               [SỬA: multer diskStorage thay vì memoryStorage]
│   └── files-preview.service.ts   [MỚI]
├── drive/
│   └── trash/             [MỚI] list trash, restore, purge vĩnh viễn
├── shares/
├── common/
│   ├── interceptors/response.interceptor.ts   [MỚI]
│   ├── dto/paginated-response.dto.ts           [MỚI]
│   └── guards/throttler.guard.ts               [MỚI, dùng @nestjs/throttler]
└── main.ts
```

---

## 5. MongoDB Collections (cập nhật)

### 5.1. DriveItem — không đổi field chính, thêm trạng thái trash rõ ràng hơn

```ts
DriveItem {
  _id: ObjectId;
  name: string;
  type: "file" | "folder";
  ownerId: ObjectId;
  parentId?: ObjectId | null;

  mimeType?: string;
  size?: number;
  bucket?: string;
  objectKey?: string;
  extension?: string;

  isDeleted: boolean;        // true = đang ở trong Trash
  deletedAt?: Date | null;   // dùng để tự động purge sau N ngày (giống Google Drive: 30 ngày)

  createdAt: Date;
  updatedAt: Date;
}
```

### 5.2. RefreshToken (MỚI)

```ts
RefreshToken {
  _id: ObjectId;
  userId: ObjectId;
  tokenHash: string;      // chỉ lưu hash, không lưu token thô
  userAgent?: string;
  expiresAt: Date;
  isRevoked: boolean;
  createdAt: Date;
}
```

### 5.3. Share — không đổi so với bản trước

(Xem lại bản gốc — schema giữ nguyên: `itemId`, `itemType`, `ownerId`, `sharedWithUserId`, `sharedWithEmail`, `permission`, `shareType`, `token`, `expiresAt`, `isRevoked`.)

---

## 6. Permission model (không đổi)

| Permission | Quyền |
|---|---|
| `view` | Xem metadata, list folder, preview |
| `download` | view + tải file |
| `edit` | view + download + rename/move/delete/upload vào folder được share |

Owner luôn full quyền. Logic `PermissionsService.getAccess` giữ nguyên (ancestor-chain).

---

## 7. API đầy đủ (đã bổ sung)

### Auth
```txt
POST   /auth/register
POST   /auth/login              → { accessToken, refreshToken, user }
POST   /auth/refresh             { refreshToken } → access token mới
POST   /auth/logout              { refreshToken } → revoke refresh token đó
POST   /auth/logout-all          → revoke toàn bộ refresh token của user (đăng xuất mọi thiết bị)
```
`/auth/login` và `/auth/register` được bọc `ThrottlerGuard` (VD: tối đa 5 lần/phút/IP).

### Folders
```txt
POST   /folders
```

### Files
```txt
POST   /files/upload
GET    /files/:id/download
GET    /files/:id/preview        [MỚI] trả về preview (ảnh resize, hoặc text snippet, hoặc PDF thumbnail)
```

### Drive
```txt
GET    /drive?parentId=&page=&limit=          [SỬA: có pagination]
GET    /drive/search?q=&type=&page=&limit=    [SỬA: filter theo type + pagination]
PATCH  /drive/:id/rename
PATCH  /drive/:id/move
DELETE /drive/:id                              # soft delete → vào Trash
```

### Trash (MỚI)
```txt
GET    /drive/trash                 # danh sách item đang trong thùng rác
PATCH  /drive/trash/:id/restore     # khôi phục về vị trí cũ
DELETE /drive/trash/:id              # xoá vĩnh viễn (xoá luôn object trên MinIO)
DELETE /drive/trash                  # dọn sạch thùng rác
```

### Shares
```txt
POST   /shares
GET    /shares
GET    /shares/shared-with-me
GET    /shares/shared-with-me/:folderId/items
DELETE /shares/:id

GET    /shares/public/:token
GET    /shares/public/:token/download
```

---

## 8. Chi tiết 7 hạng mục cải tiến

### 8.1. Fix upload streaming (không buffer RAM)

**Vấn đề:** `FileInterceptor('file')` mặc định dùng `MemoryStorage`, `file.buffer` giữ hết nội dung file trong RAM của process Node.

**Giải pháp:**
```ts
MulterModule.register({
  storage: diskStorage({
    destination: '/tmp/file-central-uploads',
    filename: (_, file, cb) => cb(null, `${uuid()}-${file.originalname}`),
  }),
  limits: { fileSize: MAX_UPLOAD_SIZE_MB * 1024 * 1024 },
});
```
Trong `FilesService.upload`, đọc file bằng `fs.createReadStream(file.path)` rồi truyền thẳng cho `MinioService.putObjectStream`. Dùng `try/finally` để `fs.unlink(file.path)` dọn file tạm bất kể thành công hay lỗi.

**Ảnh hưởng:** Cần thêm 1 cron job hoặc `onModuleInit` dọn các file tạm "mồ côi" (nếu server crash giữa chừng) — quét thư mục `/tmp/file-central-uploads` định kỳ, xoá file cũ hơn N phút.

### 8.2. Trash/Restore + Preview file

**Trash/Restore:**
- `DriveItem.isDeleted = true` + `deletedAt` đã có sẵn từ bản trước — chỉ cần thêm API list/restore.
- `restore(itemId)`: set `isDeleted = false`, `deletedAt = null`. Nếu folder cha cũng đang bị xoá thì item con **không tự "thoát" ra được** — cần restore folder cha trước (giống hành vi Google Drive thật).
- Cron job `purgeExpiredTrash()` chạy mỗi ngày: tìm item có `deletedAt < now - 30 days` → hard delete (xoá Mongo + object MinIO).

**Preview file:**
- Ảnh (`image/*`): trả về stream trực tiếp (browser tự render), có thể resize bằng `sharp` nếu muốn thumbnail.
- PDF: trả về stream với `Content-Disposition: inline` thay vì `attachment` để browser hiển thị PDF viewer luôn.
- Các loại khác (docx, xlsx...): MVP có thể chỉ trả `{ previewSupported: false }`, để dành tích hợp LibreOffice/Gotenberg sau.

### 8.3. Refresh token + Rate limit login

**Refresh token:**
- Login trả về `accessToken` (15 phút) + `refreshToken` (30 ngày, lưu **hash** trong collection `RefreshToken`).
- `POST /auth/refresh`: verify refresh token hợp lệ + chưa revoke + chưa hết hạn → issue access token mới (và refresh token mới — rotation, refresh token cũ bị revoke ngay để chống replay).
- `POST /auth/logout`: revoke đúng refresh token đó.
- `POST /auth/logout-all`: revoke toàn bộ refresh token của user — dùng khi nghi ngờ bị lộ tài khoản.

**Rate limit:**
- Dùng `@nestjs/throttler`, áp dụng riêng cho `/auth/login`, `/auth/register`: tối đa 5 request/phút/IP, trả `429 Too Many Requests` khi vượt.

### 8.4. Response DTO chuẩn hoá

**Vấn đề:** Hiện tại controller trả thẳng Mongoose document — lộ `_id` (không phải `id`), `__v`, và cả field nội bộ như `objectKey`, `bucket` (chi tiết lưu trữ MinIO không nên để client biết).

**Giải pháp:** Thêm `ResponseInterceptor` toàn cục + các DTO xuất (`DriveItemResponseDto`, `ShareResponseDto`) dùng `class-transformer`:

```ts
export class DriveItemResponseDto {
  @Expose() id: string;
  @Expose() name: string;
  @Expose() type: 'file' | 'folder';
  @Expose() mimeType?: string;
  @Expose() size?: number;
  @Expose() parentId?: string | null;
  @Expose() createdAt: Date;
  @Expose() updatedAt: Date;
  // objectKey, bucket, ownerId (raw), __v: KHÔNG expose
}
```
`ClassSerializerInterceptor` (có sẵn trong NestJS) áp dụng global trong `main.ts`, mọi service trả về Mongoose document sẽ tự động map qua DTO tương ứng trước khi ra khỏi API.

### 8.5. Pagination cho list/search

**Vấn đề:** `/drive` và `/drive/search` hiện trả về toàn bộ kết quả — folder 10.000 file sẽ crash client hoặc chậm.

**Giải pháp:** Thêm `page`, `limit` (mặc định `page=1, limit=50`, tối đa `limit=200`), trả về theo dạng chuẩn:

```json
{
  "items": [...],
  "page": 1,
  "limit": 50,
  "total": 3287,
  "totalPages": 66
}
```
Dùng `.skip((page-1)*limit).limit(limit)` kết hợp `.countDocuments()` (chạy song song bằng `Promise.all` để không tăng latency gấp đôi).

### 8.6. Dockerfile cho app + docker-compose đầy đủ 1 lệnh

**Vấn đề:** `docker-compose.yml` hiện chỉ có `mongo` + `minio`, còn app NestJS vẫn phải chạy tay bằng `npm run start:dev`.

**Giải pháp:** Thêm `Dockerfile` (multi-stage build) + service `api` vào `docker-compose.yml`:

```dockerfile
# Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package*.json ./
EXPOSE 3000
CMD ["node", "dist/main"]
```

```yaml
# thêm vào docker-compose.yml
services:
  api:
    build: .
    ports:
      - '3000:3000'
    environment:
      MONGO_URI: mongodb://mongo:27017/file-central
      MINIO_ENDPOINT: minio
      MINIO_PORT: 9000
    depends_on:
      - mongo
      - minio
```
Lưu ý: bên trong network Docker, `MINIO_ENDPOINT` phải là tên service (`minio`), không phải `localhost` — khác với khi chạy app trực tiếp trên host.

### 8.7. Unit test cho PermissionsService

Đây là logic phức tạp/dễ sai nhất trong toàn hệ thống → ưu tiên test đầu tiên. Test bằng `mongodb-memory-server` (Mongo giả lập trong RAM, không cần Docker) + Jest.

Các case tối thiểu cần cover:

```txt
1. Owner luôn có quyền EDIT, kể cả không có Share nào.
2. User không liên quan (không owner, không share) → getAccess trả permission = null.
3. Share trực tiếp trên file → đúng permission được cấu hình.
4. Share trên folder cha → file con bên trong TỰ ĐỘNG có quyền tương ứng (ancestor-chain).
5. Share trên folder ông (2 cấp) → file cháu vẫn nhận quyền (chain đi hết nhiều cấp, không chỉ 1 cấp).
6. Share đã bị revoke (isRevoked = true) → không còn hiệu lực.
7. Share đã hết hạn (expiresAt < now) → không còn hiệu lực.
8. Có nhiều Share cùng áp dụng (VD: share trực tiếp permission=view, nhưng folder cha share permission=edit) → lấy permission CAO NHẤT.
9. requireAccess ném ForbiddenException khi permission không đủ (VD: có view nhưng yêu cầu edit).
10. requireAccess ném NotFoundException khi item đã bị soft-delete.
```

Ví dụ 1 test case:

```ts
it('cascades folder share permission down to nested file', async () => {
  const folder = await createFolder({ ownerId: userA.id, name: 'Documents' });
  const file = await createFile({ ownerId: userA.id, parentId: folder._id, name: 'cv.pdf' });
  await createShare({
    itemId: folder._id,
    ownerId: userA.id,
    sharedWithUserId: userB.id,
    permission: SharePermission.EDIT,
  });

  const access = await permissionsService.getAccess(userB.id, userB.email, file._id);

  expect(access.isOwner).toBe(false);
  expect(access.permission).toBe(SharePermission.EDIT);
});
```

---

## 9. Chỉ mục MongoDB (cập nhật)

```ts
DriveItem:  { ownerId: 1, parentId: 1, isDeleted: 1 }
            { ownerId: 1, parentId: 1, name: 1 }
            { ownerId: 1, isDeleted: 1, deletedAt: 1 }   // hỗ trợ cron purge trash

Share:      { itemId: 1 }
            { ownerId: 1 }
            { sharedWithUserId: 1 }
            { sharedWithEmail: 1 }
            { token: 1 } (unique, sparse)

RefreshToken: { userId: 1 }
              { tokenHash: 1 } (unique)
              { expiresAt: 1 }   // TTL index, Mongo tự xoá token hết hạn
```

---

## 10. Roadmap triển khai (cập nhật)

### Phase 1 — Core (đã xong ở bản trước)
Auth cơ bản, tạo folder, upload/download, rename, soft delete.

### Phase 2 — Share (đã xong ở bản trước)
Share file/folder, public link, revoke.

### Phase 3 — Production-readiness (MỚI, ứng với mục 8.1 → 8.7)
```txt
1. Upload streaming (disk buffer, không RAM)
2. Trash/restore + preview file
3. Refresh token + rate limit login
4. Response DTO chuẩn hoá
5. Pagination cho list/search
6. Dockerfile + docker-compose 1 lệnh chạy hết
7. Unit test PermissionsService
```

### Phase 4 — Polish (giữ nguyên từ bản gốc, làm sau)
Quota, versioning, zip download folder, activity log, thumbnail, email notify khi share.

---

## 11. Kết luận

Bản thiết kế v2 giữ nguyên toàn bộ quyết định kiến trúc đúng của bản gốc (2 lớp MinIO/MongoDB tách biệt, ancestor-chain cho folder share, soft-delete recursive), đồng thời sửa 1 lỗi kiến trúc thật sự (`upload buffer RAM`) và bổ sung các mảnh còn thiếu để hệ thống **vận hành được ở mức gần production** chứ không chỉ là demo: có refresh token, có rate limit, có trash, có pagination, có Docker hoá đầy đủ, và có test cho phần logic khó nhất.

Thứ tự ưu tiên khi triển khai: **8.1 → 8.7** theo đúng số thứ tự ở mục 8, vì 8.1 sửa đúng lỗi kiến trúc, còn 8.7 (test) nên làm cuối để test bám theo hành vi đã ổn định của `PermissionsService`.
