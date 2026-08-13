# File Central — API Reference (cho Frontend)

Tài liệu mô tả REST API để frontend tích hợp. Base URL giả định: `https://api.yourdrive.com`.

## Quy ước chung

- Mọi request (trừ public share-link) cần header `Authorization: Bearer <accessToken>`.
- Body và response đều `application/json`, trừ upload byte (PUT thẳng lên MinIO).
- **ID** luôn là string (ObjectId serialize). **Byte size** luôn là string (Int64, tránh mất precision).
- **Timestamp** là ISO-8601 UTC string.
- Phân trang dùng **cursor**, không dùng page/offset.

### Định dạng lỗi thống nhất

```json
{
  "statusCode": 409,
  "code": "DRIVE_ITEM_VERSION_CONFLICT",
  "message": "Item was modified by another request",
  "timestamp": "2026-08-04T10:00:00.000Z"
}
```

Frontend nên switch theo `code` (máy đọc), `message` chỉ để log/hiển thị dev.

### Bảng mã lỗi

| code                                 | HTTP | Ý nghĩa                                     |
| ------------------------------------ | ---- | ------------------------------------------- |
| `UNAUTHENTICATED`                    | 401  | Thiếu/hết hạn token                         |
| `NO_ACCESS`                          | 403  | Không có quyền xem                          |
| `NO_EDIT_ACCESS`                     | 403  | Không có quyền sửa                          |
| `QUOTA_EXCEEDED`                     | 403  | Vượt dung lượng                             |
| `DRIVE_ITEM_NOT_FOUND`               | 404  | Item không tồn tại                          |
| `PARENT_NOT_FOUND`                   | 404  | Folder cha không tồn tại                    |
| `DESTINATION_NOT_FOUND`              | 404  | Folder đích không tồn tại                   |
| `NAME_ALREADY_EXISTS`                | 409  | Trùng tên trong folder                      |
| `NAME_CONFLICT_ON_RESTORE`           | 409  | Trùng tên khi khôi phục                     |
| `DRIVE_ITEM_VERSION_CONFLICT`        | 409  | Sai `expectedMetadataVersion`               |
| `CANNOT_MOVE_INTO_ITSELF`            | 400  | Move vào chính nó                           |
| `CANNOT_MOVE_INTO_SUBTREE`           | 400  | Move vào con cháu của nó                    |
| `MAX_DEPTH_EXCEEDED`                 | 400  | Vượt độ sâu 64                              |
| `MUST_TRASH_BEFORE_PERMANENT_DELETE` | 400  | Phải bỏ Trash trước khi xoá cứng            |
| `SUBTREE_TOO_LARGE`                  | 422  | Thao tác folder quá lớn để xử lý đồng bộ    |
| `LINK_UNAVAILABLE`                   | 404  | Share-link không tồn tại/hết hạn/bị thu hồi |

### Đối tượng `DriveItem` (response chuẩn)

```json
{
  "id": "6889a0b7f34c8f79ad138d22",
  "ownerId": "6889a071f34c8f79ad138d01",
  "parentId": "6889a0b7f34c8f79ad138d21",
  "name": "Quarterly Report.pdf",
  "type": "file",
  "fileStatus": "active",
  "mimeType": "application/pdf",
  "sizeBytes": "5242880",
  "extension": "pdf",
  "childCount": null,
  "isTrashed": false,
  "trashedAt": null,
  "metadataVersion": 3,
  "createdAt": "2026-07-10T00:10:00.000Z",
  "updatedAt": "2026-07-12T08:30:00.000Z",
  "lastModifiedAt": "2026-07-12T08:30:00.000Z"
}
```

- `type: "folder"` → `fileStatus/mimeType/sizeBytes/extension = null`, `childCount` là số.
- `type: "file"` → `childCount = null`, các field file có giá trị khi `fileStatus="active"`.

---

## 1. Drive items — Folder & List

### 1.1. Tạo folder

```
POST /drive/folders
```

Body:

```json
{ "name": "Reports", "parentId": null }
```

`parentId=null` = tạo ở root.

Response `201`: đối tượng `DriveItem` (folder).

Lỗi: `NAME_ALREADY_EXISTS`, `PARENT_NOT_FOUND`, `MAX_DEPTH_EXCEEDED`.

---

### 1.2. List nội dung folder (cursor pagination)

```
GET /drive?parentId={id}&sort={name|modified|type|size}&direction={asc|desc}&limit=50&cursor={cursor}
```

Query params:

- `parentId`: id folder; bỏ trống cho thư mục gốc.
- `sort`: một cột active: `name` (mặc định), `modified`, `type`, hoặc `size`.
- `direction`: `asc` (mặc định) hoặc `desc`. `type asc` cho file trước, `type desc` cho folder trước. Folder có `sizeBytes=null`, nên đứng đầu với `size asc` và cuối với `size desc`.
- `limit`: 1–200, mặc định 50.
- `cursor`: lấy từ `nextCursor` của response trước; bỏ trống cho trang đầu.

Response `200`:

```json
{
  "items": [
    {
      /* DriveItem */
    },
    {
      /* DriveItem */
    }
  ],
  "limit": 50,
  "nextCursor": "eyJ2ZXJzaW9uIjoxLCJzb3J0IjoibmFtZSIsLi4ufQ"
}
```

`nextCursor=null` khi hết. Cursor gắn với cả `sort` và `direction`; đổi một trong hai thì phải bắt đầu lại từ trang đầu. **Không dùng skip/page.**

---

### 1.3. Chi tiết 1 item

```
GET /drive/items/{id}
```

Response `200`: `DriveItem`. Lỗi: `DRIVE_ITEM_NOT_FOUND`, `NO_ACCESS`.

---

### 1.4. Breadcrumb (đường dẫn từ root)

```
GET /drive/items/{id}/breadcrumb
```

Response `200`:

```json
{
  "path": [
    { "id": "...", "name": "Reports" },
    { "id": "...", "name": "2026" },
    { "id": "...", "name": "Q3" }
  ]
}
```

Từ root → item hiện tại. Frontend render thanh breadcrumb từ mảng này.

---

## 2. Upload (negotiated flow)

Frontend **không tự quyết** single hay multipart. Gọi `POST /uploads`, server quyết và trả "hướng dẫn thi công". Byte upload **thẳng lên MinIO** qua presigned URL, không qua API server.

> Khuyến nghị: dùng **Uppy + @uppy/aws-s3** để lo chunk/song song/resume/retry tự động. Phần dưới mô tả API thô để bạn hiểu hoặc tự implement client.

### 2.1. Khởi tạo upload

```
POST /uploads
```

Body:

```json
{
  "name": "video.mp4",
  "parentId": "6889a0b7f34c8f79ad138d21",
  "declaredSizeBytes": "1073741824",
  "idempotencyKey": "a1b2c3d4-..."
}
```

`idempotencyKey`: UUID client sinh; retry cùng key trả về cùng session (không tạo trùng).

**Response — file nhỏ (`method="single"`):**

```json
{
  "uploadSessionId": "...",
  "method": "single",
  "putUrl": "https://minio.../objects/...?X-Amz-Signature=...",
  "expiresAt": "2026-08-04T11:00:00.000Z"
}
```

**Response — file vừa/nặng (`method="multipart"`):**

```json
{
  "uploadSessionId": "...",
  "method": "multipart",
  "partSizeBytes": 8388608,
  "expectedPartsCount": 128,
  "partUrls": [
    { "partNumber": 1, "url": "https://minio.../...partNumber=1..." },
    { "partNumber": 2, "url": "https://minio.../...partNumber=2..." }
  ],
  "expiresAt": "2026-08-04T11:00:00.000Z"
}
```

Lỗi: `QUOTA_EXCEEDED`, `NAME_ALREADY_EXISTS`, `PARENT_NOT_FOUND`.

### 2.2. Upload byte (thẳng lên MinIO)

**Single:** một PUT tới `putUrl`.

```
PUT {putUrl}
Content-Type: <mime>
Body: <toàn bộ file>
```

**Multipart:** mỗi part một PUT tới `partUrls[i].url`, có thể song song.

```
PUT {partUrls[i].url}
Body: <chunk thứ i, kích thước partSizeBytes (part cuối nhỏ hơn)>
```

**Đọc header `ETag` từ mỗi response PUT** — cần cho bước complete. (MinIO phải bật CORS `ExposeHeaders: ["ETag"]`, nếu không browser không đọc được ETag.)

### 2.3. Kiểm tra trạng thái / resume (sau mất mạng)

```
GET /uploads/{id}/status
```

Response `200`:

```json
{
  "status": "pending",
  "totalParts": 128,
  "uploadedParts": 40,
  "uploadedPartsList": [{ "partNumber": 1, "etag": "\"abc\"", "sizeBytes": 8388608 }],
  "missingPartUrls": [{ "partNumber": 41, "url": "https://minio.../...partNumber=41..." }]
}
```

Khi mạng có lại: gọi endpoint này → chỉ upload các part trong `missingPartUrls` (URL đã cấp lại mới, vì URL cũ có thể hết hạn). Part đã xong bỏ qua.

### 2.4. Hoàn tất upload

```
POST /uploads/{id}/complete
```

Body — **multipart**:

```json
{
  "parts": [
    { "partNumber": 1, "etag": "\"abc\"", "sizeBytes": "8388608" },
    { "partNumber": 2, "etag": "\"def\"", "sizeBytes": "8388608" }
  ]
}
```

Body — **single**: rỗng `{}`.

Response `200`:

```json
{ "driveItemId": "...", "status": "completed" }
```

Sau bước này file có `fileStatus="active"`, hiện trong folder. Gọi lại (retry) trả cùng kết quả.

### 2.5. Huỷ upload

```
POST /uploads/{id}/abort
```

Response `200`: `{ "status": "aborted" }`. Dọn multipart trên MinIO + release quota đã giữ.

### Sơ đồ luồng client

```
POST /uploads ──▶ method?
   single    ──▶ PUT putUrl ─────────────────────────▶ POST /uploads/:id/complete {}
   multipart ──▶ PUT từng part (song song, lấy ETag) ─▶ POST /uploads/:id/complete { parts }
                    │ mất mạng?
                    └─▶ GET /uploads/:id/status ─▶ PUT các missingPartUrls ─▶ complete
```

---

## 3. Thao tác metadata — Rename & Move

Cả hai dùng **optimistic concurrency**: client gửi `expectedMetadataVersion` (lấy từ `DriveItem.metadataVersion` đang có). Nếu ai đó sửa trước → `409 DRIVE_ITEM_VERSION_CONFLICT`, frontend cần load lại item và thử lại.

### 3.1. Rename

```
PATCH /drive/items/{id}/rename
```

Body:

```json
{ "name": "New Name.pdf", "expectedMetadataVersion": 3 }
```

Response `200`: `DriveItem` (đã tăng `metadataVersion`). Lỗi: `NAME_ALREADY_EXISTS`, `DRIVE_ITEM_VERSION_CONFLICT`, `NO_EDIT_ACCESS`.

### 3.2. Move

```
PATCH /drive/items/{id}/move
```

Body:

```json
{ "newParentId": "6889a0b7f34c8f79ad138d99", "expectedMetadataVersion": 3 }
```

`newParentId=null` = move ra root.

Response `200`: `DriveItem`.

Lỗi: `CANNOT_MOVE_INTO_ITSELF`, `CANNOT_MOVE_INTO_SUBTREE`, `DESTINATION_NOT_FOUND`, `MAX_DEPTH_EXCEEDED`, `DRIVE_ITEM_VERSION_CONFLICT`.

> **Move folder lớn:** nếu subtree vượt ngưỡng đồng bộ → `422 SUBTREE_TOO_LARGE`. Frontend hiển thị "đang xử lý" và (giai đoạn worker) poll trạng thái. MVP: chặn với lỗi này.

---

## 4. Preview & Download

```
GET /drive/items/{id}/download-url
```

Response `200`:

```json
{
  "url": "https://minio.../objects/...?X-Amz-Signature=...",
  "expiresInSeconds": 3600
}
```

- URL presigned ngắn hạn, dùng để `<img>`, `<video>`, `<iframe>` hoặc tải xuống.
- Hỗ trợ HTTP Range sẵn (video/pdf seek được).
- Yêu cầu file `fileStatus="active"`. Cần quyền view (owner / được share / qua link).
- URL hết hạn thì gọi lại endpoint để lấy URL mới.

Lỗi: `NO_ACCESS`, `DRIVE_ITEM_NOT_FOUND`, `STORAGE_OBJECT_UNAVAILABLE`.

---

## 5. Trash (xóa mềm) — Restore — Xóa cứng

### 5.1. Đưa vào Trash

```
POST /drive/items/{id}/trash
```

Response `200`: `DriveItem` (`isTrashed=true`, `trashedAt` set). Với folder: cả subtree được đánh dấu trash. Byte trên MinIO KHÔNG bị xoá.

### 5.2. List Trash

```
GET /drive/trash?limit=50&cursor={cursor}
```

Response `200`: giống list folder nhưng chỉ item `isTrashed=true`, sort theo `trashedAt` desc.

### 5.3. Khôi phục

```
POST /drive/items/{id}/restore
```

Response `200`: `DriveItem` (`isTrashed=false`). Lỗi: `NAME_CONFLICT_ON_RESTORE` (trùng tên với item active ở folder đích — frontend hỏi user đổi tên hoặc chọn đích khác).

### 5.4. Xóa cứng (vĩnh viễn)

```
DELETE /drive/items/{id}
```

Chỉ áp dụng item **đang trong Trash**. Xoá byte MinIO + metadata + dọn permission/share-link. Không khôi phục được.

Response `200`: `{ "deleted": true }`. Lỗi: `MUST_TRASH_BEFORE_PERMANENT_DELETE`, `SUBTREE_TOO_LARGE` (folder lớn).

### 5.5. Dọn sạch Trash

```
DELETE /drive/trash
```

Xoá cứng toàn bộ item trong Trash của user. Response `200`: `{ "deletedCount": 12 }`.

---

## 6. Sharing — user cụ thể & public link

### 6.1. Share cho user cụ thể

```
POST /drive/items/{id}/permissions
```

Body:

```json
{ "granteeUserId": "6889...", "role": "viewer", "canDownload": true }
```

`role`: `viewer` (chỉ xem/tải) hoặc `editor` (rename/move/organize/share metadata — KHÔNG sửa nội dung file). Share folder → item bên trong tự kế thừa quyền.

Response `201`:

```json
{ "id": "...", "itemId": "...", "granteeUserId": "...", "role": "viewer", "canDownload": true }
```

Lỗi: `NO_EDIT_ACCESS`.

### 6.2. Danh sách người được share trên 1 item

```
GET /drive/items/{id}/permissions
```

Response `200`:

```json
{
  "permissions": [{ "id": "...", "granteeUserId": "...", "role": "editor", "canDownload": true }]
}
```

### 6.3. Thu hồi quyền

```
DELETE /drive/items/{id}/permissions/{granteeUserId}
```

Response `200`: `{ "revoked": true }`.

### 6.4. "Được chia sẻ với tôi"

```
GET /drive/shared-with-me?limit=50&cursor={cursor}
```

Response `200`: danh sách `DriveItem` mà user hiện tại được share (không phải owner).

### 6.5. Tạo public share-link

```
POST /drive/items/{id}/share-links
```

Body (mọi field optional):

```json
{ "canDownload": true, "password": "secret", "expiresAt": "2026-09-01T00:00:00.000Z" }
```

Response `201`:

```json
{
  "id": "...",
  "url": "https://app.yourdrive.com/s/xToK3n...",
  "expiresAt": "2026-09-01T00:00:00.000Z"
}
```

**`url` chỉ trả về MỘT LẦN** (token thô không lưu lại). Frontend cho user copy ngay.

### 6.6. Thu hồi share-link

```
DELETE /drive/share-links/{linkId}
```

Response `200`: `{ "revoked": true }`.

### 6.7. Truy cập qua public link (KHÔNG cần auth)

```
POST /public/share/{token}/resolve
```

Body (nếu link có mật khẩu): `{ "password": "secret" }`.

Response `200`:

```json
{
  "item": {
    /* DriveItem rút gọn: id, name, type, mimeType, sizeBytes */
  },
  "canDownload": true
}
```

Lấy URL tải:

```
POST /public/share/{token}/download-url
```

Response `200`: `{ "url": "https://minio...", "expiresInSeconds": 3600 }`.

Lỗi: `LINK_UNAVAILABLE` (revoked/expired/unknown đều trả CÙNG lỗi này để tránh dò tồn tại).

---

## 7. Star (đánh dấu sao) — tuỳ chọn

### 7.1. Star / Unstar

```
PUT /drive/items/{id}/star      body: { "starred": true }
```

Response `200`: `{ "itemId": "...", "isStarred": true }`. Trạng thái star là **riêng mỗi user** (không dùng chung).

### 7.2. List item đã star

```
GET /drive/starred?limit=50&cursor={cursor}
```

Response `200`: danh sách `DriveItem` user đã star.

---

## 8. Ví dụ luồng frontend điển hình

### Upload 1 file lớn có resume (thô, không dùng Uppy)

```ts
// 1. Init
const init = await api("POST", "/uploads", {
  name: file.name,
  parentId: currentFolderId,
  declaredSizeBytes: String(file.size),
  idempotencyKey: crypto.randomUUID(),
});

if (init.method === "single") {
  await fetch(init.putUrl, { method: "PUT", body: file });
  await api("POST", `/uploads/${init.uploadSessionId}/complete`, {});
} else {
  // 2. Upload từng part, lưu ETag
  const parts = [];
  for (const { partNumber, url } of init.partUrls) {
    const chunk = sliceChunk(file, partNumber, init.partSizeBytes);
    const res = await fetch(url, { method: "PUT", body: chunk });
    parts.push({
      partNumber,
      etag: res.headers.get("ETag"),
      sizeBytes: String(chunk.size),
    });
    // Nếu mất mạng: bắt lỗi -> gọi GET /uploads/:id/status -> retry missingPartUrls
  }
  // 3. Complete
  await api("POST", `/uploads/${init.uploadSessionId}/complete`, { parts });
}

// 4. Refresh danh sách folder
await api("GET", `/drive/items?parentId=${currentFolderId}`);
```

### Rename với xử lý version conflict

```ts
try {
  const updated = await api("PATCH", `/drive/items/${id}/rename`, {
    name: newName,
    expectedMetadataVersion: item.metadataVersion,
  });
  // dùng updated.metadataVersion mới
} catch (e) {
  if (e.code === "DRIVE_ITEM_VERSION_CONFLICT") {
    const fresh = await api("GET", `/drive/items/${id}`);
    // hiển thị "item đã thay đổi", cho user xác nhận rồi thử lại với fresh.metadataVersion
  } else if (e.code === "NAME_ALREADY_EXISTS") {
    // báo trùng tên
  }
}
```

---

## 9. Tổng hợp endpoint

| Method | Path                                            | Mô tả                         |
| ------ | ----------------------------------------------- | ----------------------------- |
| POST   | `/drive/folders`                                | Tạo folder                    |
| GET    | `/drive/items`                                  | List nội dung folder (cursor) |
| GET    | `/drive/items/{id}`                             | Chi tiết item                 |
| GET    | `/drive/items/{id}/breadcrumb`                  | Đường dẫn từ root             |
| POST   | `/uploads`                                      | Khởi tạo upload (negotiated)  |
| GET    | `/uploads/{id}/status`                          | Trạng thái / resume           |
| POST   | `/uploads/{id}/complete`                        | Hoàn tất upload               |
| POST   | `/uploads/{id}/abort`                           | Huỷ upload                    |
| PATCH  | `/drive/items/{id}/rename`                      | Đổi tên                       |
| PATCH  | `/drive/items/{id}/move`                        | Di chuyển                     |
| GET    | `/drive/items/{id}/download-url`                | URL preview/download          |
| POST   | `/drive/items/{id}/trash`                       | Xóa mềm                       |
| GET    | `/drive/trash`                                  | List Trash                    |
| POST   | `/drive/items/{id}/restore`                     | Khôi phục                     |
| DELETE | `/drive/items/{id}`                             | Xóa cứng                      |
| DELETE | `/drive/trash`                                  | Dọn sạch Trash                |
| POST   | `/drive/items/{id}/permissions`                 | Share cho user                |
| GET    | `/drive/items/{id}/permissions`                 | DS người được share           |
| DELETE | `/drive/items/{id}/permissions/{granteeUserId}` | Thu hồi quyền                 |
| GET    | `/drive/shared-with-me`                         | Được chia sẻ với tôi          |
| POST   | `/drive/items/{id}/share-links`                 | Tạo public link               |
| DELETE | `/drive/share-links/{linkId}`                   | Thu hồi link                  |
| POST   | `/public/share/{token}/resolve`                 | Mở link công khai (no auth)   |
| POST   | `/public/share/{token}/download-url`            | Tải qua link công khai        |
| PUT    | `/drive/items/{id}/star`                        | Star/unstar                   |
| GET    | `/drive/starred`                                | List đã star                  |

---

## 10. Ghi chú cho frontend

- **Luôn ưu tiên Uppy** cho upload để khỏi tự viết resume/retry/song song.
- **Byte size là string** — dùng `BigInt` hoặc thư viện format khi hiển thị (vd `5242880` → "5 MB"), đừng parse ra `Number` nếu file có thể > 9 PB (thực tế hiếm, nhưng contract là string).
- **metadataVersion** phải được giữ và gửi lại ở rename/move; sau mỗi lần sửa, cập nhật giá trị mới từ response.
- **Presigned URL** (upload part, download) có hạn ~1h — không cache lâu, xin lại khi cần.
- **Trạng thái file**: sau upload complete, `fileStatus` chuyển `active`. Nếu thấy `uploading`/ `processing`/`failed`, file chưa sẵn sàng để preview.
- **childCount** là gần đúng — dùng để hiển thị badge số lượng, không dựa vào nó cho logic chính xác.
