# File Central v2

MVP kiểu Google Drive: **NestJS 11** đứng giữa, **MongoDB** lưu metadata (folder/file/permission/share/refresh-token), **MinIO** lưu file binary thật.

```
Browser / Mobile
      │  HTTPS
      ▼
NestJS API (Throttler → JwtAuthGuard → Controller → Service → PermissionsService → ResponseInterceptor)
      │
      ├── MongoDB   (metadata, permission, share, refresh token, trash state)
      └── MinIO     (binary object, upload/download qua stream, KHÔNG buffer RAM)
```

Toàn bộ stack dùng **bản mới nhất tại thời điểm build**: NestJS 11.1, Mongoose 9.7, Express 5, TypeScript 5.7, Jest 30.

## 1. Chạy thử — cách nhanh nhất (Docker, 1 lệnh)

```bash
docker compose up -d --build
```

Lệnh này chạy cả 3 service: `mongo`, `minio`, và `api` (chính app NestJS, build từ `Dockerfile`). Không cần cài Node.js trên máy host.

- API: http://localhost:3000
- Swagger docs: http://localhost:3000/docs
- MinIO console: http://localhost:9001 (`minioadmin` / `minioadmin`)

## 2. Chạy thử — cách dev (hot reload)

```bash
npm install
cp .env.example .env
docker compose up -d mongo minio   # chỉ chạy 2 service phụ thuộc, không chạy api
npm run start:dev
```

## 3. Chạy test

```bash
npm test
```

Test hiện có: `PermissionsService` (11 test case) — logic ancestor-chain phức tạp nhất trong hệ thống. Dùng mock model thủ công (không dùng `mongodb-memory-server`) nên chạy được hoàn toàn offline, không cần tải mongod binary.

## 4. Cấu trúc thư mục

```
src/
├── auth/            # register/login/refresh/logout, JWT access + refresh token
│   └── schemas/refresh-token.schema.ts
├── users/
├── drive-items/     # DriveItem schema dùng chung (file+folder) + mọi helper cây thư mục
├── permissions/      # Logic ancestor-chain (owner / share trực tiếp / share qua folder cha)
│   └── permissions.service.spec.ts   # 11 unit test
├── storage/          # MinioService — chỉ biết bucket/objectKey/binary
├── folders/           # POST /folders
├── files/              # upload (disk-streamed, không buffer RAM), download, preview
├── drive/
│   ├── (list/search có pagination, rename, move, delete)
│   └── trash/          # NEW: list/restore/purge thùng rác
├── shares/             # Share file/folder, public link, "shared with me"
└── common/
    ├── dto/             # DriveItemResponseDto, ShareResponseDto, PaginatedResponseDto
    ├── mappers/          # response-mapper.ts — ẩn field nội bộ (objectKey, bucket, __v)
    ├── utils/token.util.ts   # sinh token bằng crypto (thay nanoid, tránh vấn đề ESM-only)
    └── guards / filters / decorators
```

## 5. Những gì đã nâng cấp so với bản MVP đầu tiên

| # | Hạng mục | Đã làm |
|---|---|---|
| 1 | Upload streaming | Multer `diskStorage` thay vì `memoryStorage` — file được ghi tạm ra disk rồi re-stream lên MinIO, RAM không phình theo dung lượng file. Temp file luôn được dọn (`finally`) dù thành công hay lỗi. |
| 2 | Trash/Restore + Preview | `GET/PATCH/DELETE /trash*` (xem mục 7), `GET /files/:id/preview` (stream inline, chỉ cần quyền VIEW thay vì DOWNLOAD). |
| 3 | Refresh token + rate limit | Login/register trả `{ accessToken (15p), refreshToken (30 ngày, hash SHA-256 trong Mongo) }`. `POST /auth/refresh` xoay vòng token. `POST /auth/logout(-all)` revoke. `@nestjs/throttler` giới hạn 5 request/phút cho login/register, 60/phút mặc định toàn app. |
| 4 | Response DTO chuẩn hoá | `DriveItemResponseDto` / `ShareResponseDto` qua `class-transformer`, ẩn hẳn `objectKey`, `bucket`, `__v`. Áp dụng thủ công ở từng controller + `ClassSerializerInterceptor` toàn cục làm lớp phòng thủ thứ 2. |
| 5 | Pagination | `GET /drive?page=&limit=` và `GET /drive/search?q=&type=&page=&limit=` trả `{ items, page, limit, total, totalPages }`. |
| 6 | Docker hoá đầy đủ | `Dockerfile` multi-stage + `docker-compose.yml` có service `api`, chạy `docker compose up -d --build` là xong cả 3 service. |
| 7 | Unit test | `permissions.service.spec.ts` — 11 case bao gồm cascade 2 cấp, permission cao nhất thắng, revoke/expire, Forbidden/NotFound. |

## 6. API Reference

### Auth
```
POST /auth/register        { email, name, password }
POST /auth/login           { email, password } → { accessToken, refreshToken, user }
POST /auth/refresh          { refreshToken } → { accessToken, refreshToken }  (xoay vòng)
POST /auth/logout           { refreshToken }
POST /auth/logout-all       (cần Bearer token) → revoke toàn bộ refresh token của user
```
Login/register bị giới hạn 5 request/phút/IP (chống brute-force).

### Folders
```
POST /folders   { name, parentId? }
```

### Files
```
POST /files/upload            multipart/form-data: file, parentId?
GET  /files/:id/download      quyền tối thiểu: download
GET  /files/:id/preview       quyền tối thiểu: view (inline, không ép tải)
```

### Drive
```
GET    /drive?parentId=&page=&limit=
GET    /drive/search?q=&type=file|folder&page=&limit=
PATCH  /drive/:id/rename       { name }
PATCH  /drive/:id/move         { newParentId }
DELETE /drive/:id               # soft delete → vào Trash
```

### Trash
```
GET    /trash                  # danh sách "gốc" đang trong thùng rác
PATCH  /trash/:id/restore       # khôi phục (phải restore folder cha trước nếu cha cũng đang trong trash)
DELETE /trash/:id                # xoá vĩnh viễn 1 item (và cây con nếu là folder)
DELETE /trash                    # dọn sạch toàn bộ thùng rác
```

### Shares
```
POST   /shares                        # { itemId, shareType, permission, sharedWithEmail?, expiresAt? }
GET    /shares                        # share do mình tạo
GET    /shares/shared-with-me         # item được share trực tiếp cho mình
GET    /shares/shared-with-me/:folderId/items   # duyệt vào bên trong 1 folder được share
DELETE /shares/:id                    # revoke

GET    /shares/public/:token              # metadata (không cần login)
GET    /shares/public/:token/download     # download qua public link (không cần login)
```

## 7. Permission model

| Permission | Quyền |
|---|---|
| `view` | Xem metadata, list folder, preview |
| `download` | view + tải file |
| `edit` | view + download + rename/move/delete/upload vào folder được share |

Owner luôn full quyền. Share trên 1 folder tự động áp dụng cho toàn bộ cây con bên trong (kiểm tra ancestor-chain lúc runtime, không copy permission xuống từng item).

## 8. Lưu ý triển khai đáng chú ý

- **Route `/trash` tách khỏi `/drive`**: thiết kế gốc đề xuất `/drive/trash`, nhưng vì `DELETE /drive/:id` (xoá 1 item) và `DELETE /drive/trash` (dọn sạch trash) cùng khớp pattern 2-segment `/drive/<x>`, Express/Nest sẽ khớp nhầm tuỳ thứ tự khai báo route. Để tránh rủi ro này hoàn toàn, Trash được tách thành controller riêng ở `/trash` (1-segment gốc, không đụng độ với `/drive/:id` hay `/drive/:id/rename`).
- **`nanoid` đã bị loại bỏ**: các bản `nanoid` mới (v4+) chỉ hỗ trợ ESM, xung đột với project biên dịch CommonJS. Thay bằng `crypto.randomBytes(...).toString('base64url')` (xem `common/utils/token.util.ts`) — không cần thêm dependency.
- **Không dùng `mongodb-memory-server` cho test**: package này cần tải binary `mongod` qua mạng lúc chạy lần đầu, không khả thi trong môi trường build/CI không có Internet ra ngoài registry npm. Test `PermissionsService` dùng mock Model thủ công, chạy 100% offline.
- **TypeScript ghim ở `^5.7.3`**, không dùng bản `7.x` mới nhất, vì `ts-jest@29` khai báo peer dependency `typescript: '>=4.3 <7'` — dùng TS7 sẽ vỡ test runner.
