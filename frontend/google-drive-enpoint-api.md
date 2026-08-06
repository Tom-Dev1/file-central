# File Central — API Endpoints theo Phase

**Phiên bản:** 2.0  
**Base URL:** `/api/v1`  
**Nguồn thiết kế:** `file-central-database-schema-scale-reviewed-v3.md`  
**Mục tiêu:** triển khai API theo đúng thứ tự phụ thuộc của schema, ưu tiên mạnh luồng Drive / Folder / File và không tạo public endpoint không cần thiết cho collection nội bộ.

---

## 1. Nguyên tắc thiết kế API

### 1.1. Phân vai resource

```text
drive_items
→ metadata chung của file và folder
→ list, detail, rename, move, soft delete

folders
→ tạo folder, breadcrumb, folder picker
→ nghiệp vụ cây đặc thù

files
→ content, preview, version history

upload_sessions
→ tạo và theo dõi quá trình upload
→ single PUT hoặc multipart

trash
→ list, restore, hard delete

permissions / share-links / invitations
→ chia sẻ và phân quyền

operations
→ theo dõi công việc recursive chạy nền
```

### 1.2. Không ánh xạ một collection thành một public API một cách máy móc

Các collection sau chủ yếu là **internal**, không cần CRUD public:

```text
file_blobs
quota_transactions
outbox_events
search_documents
idempotency_keys
security_audit_events
audit_logs
```

Chúng được quản lý bởi service, worker hoặc admin endpoint có giới hạn.

### 1.3. Quy tắc route

- Dùng danh từ số nhiều.
- Dùng `GET` để đọc.
- Dùng `POST` để tạo resource hoặc kích hoạt transition không thể biểu diễn bằng CRUD.
- Dùng `PATCH` để cập nhật một phần.
- Dùng `DELETE` để soft delete, revoke hoặc hard delete theo đúng resource.
- Hành vi chung của file/folder đi qua `/drive/items/:itemId`.
- Hành vi đặc thù file đi qua `/files/:fileId`.
- Hành vi đặc thù folder đi qua `/drive/folders/:folderId`.
- List nóng dùng cursor, không dùng page sâu với `skip`.
- API tạo dữ liệu quan trọng hỗ trợ `Idempotency-Key`.
- Update metadata hỗ trợ optimistic concurrency bằng `If-Match` hoặc `expectedVersion`.

---

# 2. Tổng quan theo Phase

| Phase   | Trọng tâm                         | Mức ưu tiên                      |
| ------- | --------------------------------- | -------------------------------- |
| Phase 0 | Auth, user, session, nền tảng API | Bắt buộc                         |
| Phase 1 | Drive navigation và folder core   | Bắt buộc                         |
| Phase 2 | Recursive operations và Trash     | Bắt buộc trước cây lớn           |
| Phase 3 | Upload session và finalize file   | Bắt buộc                         |
| Phase 4 | Download, preview, version        | Bắt buộc cho file hoàn chỉnh     |
| Phase 5 | Permission và share               | Sau khi core ổn định             |
| Phase 6 | Starred, recent, shortcut         | Trải nghiệm người dùng           |
| Phase 7 | Search, quota, activity           | Production feature               |
| Phase 8 | Operations, health, audit         | Vận hành production              |
| Phase 9 | Scale hardening                   | Benchmark, không mở API tùy tiện |

---

# 3. Phase 0 — Auth, User và Session

## 3.1. Mục tiêu

Hoàn thành:

- User schema.
- Đăng ký và đăng nhập.
- Access token.
- Refresh token rotation.
- Session listing và revoke.
- `CurrentUser` cho toàn bộ Drive API.

## 3.2. Endpoints

### Đăng ký

```http
POST /api/v1/auth/register
Idempotency-Key: <uuid>
```

Body:

```json
{
  "email": "nam@example.com",
  "username": "truongnam",
  "name": "Truong Sy Nam",
  "password": "StrongPassword123!"
}
```

Response:

```http
201 Created
```

### Đăng nhập

```http
POST /api/v1/auth/login
```

Body:

```json
{
  "identifier": "nam@example.com",
  "password": "StrongPassword123!"
}
```

`identifier` cho phép email hoặc username.

### Làm mới token

```http
POST /api/v1/auth/refresh
```

### Đăng xuất phiên hiện tại

```http
POST /api/v1/auth/logout
```

### Lấy danh sách phiên

```http
GET /api/v1/auth/sessions?cursor=&limit=20
```

### Revoke một phiên

```http
DELETE /api/v1/auth/sessions/:sessionId
```

### Revoke toàn bộ phiên

```http
DELETE /api/v1/auth/sessions
```

### Lấy profile hiện tại

```http
GET /api/v1/users/me
```

### Cập nhật profile

```http
PATCH /api/v1/users/me
```

## 3.3. Collection liên quan

```text
users
user_sessions
refresh_tokens
security_audit_events
```

## 3.4. Guard áp dụng từ Phase 1

```text
JwtAuthGuard
CurrentUser decorator
ThrottlerGuard
```

---

# 4. Phase 1 — Drive Navigation và Folder Core

## 4.1. Mục tiêu

Hoàn thành luồng:

```text
Mở My Drive
→ tạo folder
→ mở folder
→ list file/folder con
→ xem metadata
→ breadcrumb
→ rename
→ move item nhỏ
→ soft delete item nhỏ
```

`drive_items` là collection nóng nhất của phase này.

---

## 4.2. List nội dung Drive

```http
GET /api/v1/drive/items
```

Root:

```http
GET /api/v1/drive/items?limit=50
```

Trong folder:

```http
GET /api/v1/drive/items?parentId=<folderId>&limit=50
```

Query đầy đủ:

| Query      | Giá trị                        |
| ---------- | ------------------------------ |
| `parentId` | UUID hoặc bỏ trống cho root    |
| `type`     | `file`, `folder` hoặc bỏ trống |
| `sort`     | `lastModifiedAt`, `name`       |
| `order`    | `asc`, `desc`                  |
| `cursor`   | opaque cursor                  |
| `limit`    | mặc định 50, tối đa 100        |

Response:

```json
{
  "data": [
    {
      "id": "0194...",
      "name": "Documents",
      "type": "folder",
      "parentId": null,
      "status": "active",
      "operationState": "idle",
      "childCount": 10,
      "version": 3,
      "lastModifiedAt": "2026-07-29T05:00:00.000Z",
      "capabilities": {
        "canOpen": true,
        "canRename": true,
        "canMove": true,
        "canDelete": true,
        "canShare": true,
        "canUploadChild": true
      }
    }
  ],
  "meta": {
    "limit": 50,
    "nextCursor": null,
    "hasNextPage": false
  }
}
```

Không serialize trong list:

```text
normalizedName
ancestorIds
storage object key
blob id
internal MongoDB _id
```

---

## 4.3. Lấy chi tiết item

```http
GET /api/v1/drive/items/:itemId
```

Dùng cho:

- Open dialog.
- Properties.
- Refresh metadata.
- Resolve capabilities.
- Kiểm tra trạng thái operation.

---

## 4.4. Tạo folder

```http
POST /api/v1/drive/folders
Idempotency-Key: <uuid>
```

Body:

```json
{
  "name": "Documents",
  "parentId": null
}
```

Response:

```http
201 Created
Location: /api/v1/drive/items/<folderId>
```

Backend phải kiểm tra:

```text
parent tồn tại
parent là folder
cùng owner/scope
parent chưa bị xóa
operationState = idle
không vượt MAX_FOLDER_DEPTH
không trùng active normalizedName
```

---

## 4.5. Breadcrumb

```http
GET /api/v1/drive/folders/:folderId/breadcrumb
```

Response:

```json
{
  "data": [
    {
      "id": "root-child-id",
      "name": "Documents"
    },
    {
      "id": "current-id",
      "name": "Backend"
    }
  ]
}
```

Backend:

```text
đọc ancestorIds
→ batch query tên ancestor
→ giữ đúng thứ tự root → current
```

---

## 4.6. Folder picker

Endpoint này phục vụ Move dialog, không phải màn hình Drive chính:

```http
GET /api/v1/drive/folders?parentId=&cursor=&limit=50
```

Chỉ trả folder.

Có thể bổ sung:

```http
GET /api/v1/drive/folders?excludeSubtreeOf=<folderId>
```

để không hiển thị chính folder đang move và descendant của nó.

---

## 4.7. Rename hoặc move một item

```http
PATCH /api/v1/drive/items/:itemId
If-Match: "<item-version>"
```

Rename:

```json
{
  "name": "New name"
}
```

Move:

```json
{
  "parentId": "destination-folder-id"
}
```

Rename và move cùng request:

```json
{
  "name": "New name",
  "parentId": "destination-folder-id"
}
```

Response:

```http
200 OK
```

Nếu version không còn đúng:

```http
412 Precondition Failed
```

Nếu tạo cycle:

```http
409 Conflict
```

---

## 4.8. Soft delete

```http
DELETE /api/v1/drive/items/:itemId
If-Match: "<item-version>"
```

Item nhỏ:

```http
204 No Content
```

Folder lớn:

```http
202 Accepted
```

Response cho async:

```json
{
  "data": {
    "operationId": "operation-id",
    "status": "queued"
  }
}
```

---

## 4.9. Collection liên quan

```text
drive_items
outbox_events
idempotency_keys
```

---

# 5. Phase 2 — Recursive Operations và Trash

## 5.1. Mục tiêu

Hoàn thành:

- Move folder lớn.
- Delete folder lớn.
- Restore subtree.
- Empty Trash.
- Copy folder.
- Worker checkpoint/retry.
- `processing_jobs`.
- `operationState` lock.

Các endpoint Phase 1 vẫn giữ nguyên; chỉ thay đổi response:

```text
small operation → 200/204
large operation → 202 + operationId
```

---

## 5.2. List Trash

```http
GET /api/v1/drive/trash?cursor=&limit=50
```

Query tùy chọn:

| Query           | Ý nghĩa     |
| --------------- | ----------- |
| `type`          | file/folder |
| `deletedAfter`  | filter      |
| `deletedBefore` | filter      |
| `cursor`        | cursor      |
| `limit`         | tối đa 100  |

---

## 5.3. Restore

```http
POST /api/v1/drive/trash/:itemId/restore
Idempotency-Key: <uuid>
```

Body tùy chọn:

```json
{
  "conflictPolicy": "fail"
}
```

Policy về sau:

```text
fail
auto_rename
restore_to_root
```

Response:

```text
200 OK     → item/subtree nhỏ
202 Accepted → subtree lớn
```

---

## 5.4. Hard delete một item hoặc subtree

```http
DELETE /api/v1/drive/trash/:itemId
```

Luôn có thể trả:

```http
202 Accepted
```

vì còn liên quan:

```text
file_versions
file_blobs refCount
storage object GC
permissions
share links
activity/audit
```

Hard delete không nên giữ HTTP connection cho toàn bộ quá trình.

---

## 5.5. Empty Trash

```http
DELETE /api/v1/drive/trash
Idempotency-Key: <uuid>
```

Response:

```http
202 Accepted
```

---

## 5.6. Copy item hoặc folder

```http
POST /api/v1/drive/items/:itemId/copies
Idempotency-Key: <uuid>
```

Body:

```json
{
  "parentId": "destination-folder-id",
  "name": "Copy of Documents"
}
```

Response:

```text
201 Created    → file hoặc subtree nhỏ
202 Accepted   → folder lớn
```

---

## 5.7. Theo dõi operation

```http
GET /api/v1/operations/:operationId
```

Response:

```json
{
  "data": {
    "id": "operation-id",
    "type": "folder_move_cascade",
    "status": "processing",
    "progress": 42.5,
    "rootItemId": "folder-id",
    "result": null,
    "error": null,
    "createdAt": "2026-07-29T05:00:00.000Z",
    "completedAt": null
  }
}
```

List operation của user:

```http
GET /api/v1/operations?status=processing&cursor=&limit=20
```

---

## 5.8. Collection liên quan

```text
drive_items
processing_jobs
outbox_events
file_versions
file_blobs
```

---

# 6. Phase 3 — Upload Session và File Finalization

## 6.1. Mục tiêu

Không proxy toàn bộ file lớn qua NestJS.

Luồng scale-ready:

```text
Frontend
→ tạo upload session tại NestJS
→ nhận signed URL / multipart instructions
→ upload trực tiếp MinIO/S3
→ báo complete
→ worker verify checksum/MIME/scan
→ dedup + file version
→ item active
```

---

## 6.2. Tạo upload session

```http
POST /api/v1/upload-sessions
Idempotency-Key: <uuid>
```

### Upload file mới

```json
{
  "target": {
    "kind": "new_file",
    "parentId": "folder-id",
    "name": "report.pdf"
  },
  "declaredSize": 5242880,
  "declaredChecksum": "sha256-value",
  "contentType": "application/pdf",
  "method": "put"
}
```

### Upload version mới cho file có sẵn

```json
{
  "target": {
    "kind": "new_version",
    "itemId": "file-id"
  },
  "declaredSize": 5242880,
  "declaredChecksum": "sha256-value",
  "contentType": "application/pdf",
  "method": "multipart"
}
```

Response single PUT:

```json
{
  "data": {
    "id": "upload-session-id",
    "itemId": "placeholder-item-id",
    "method": "put",
    "status": "pending",
    "upload": {
      "url": "signed-url",
      "method": "PUT",
      "headers": {}
    },
    "expiresAt": "2026-07-29T06:00:00.000Z"
  }
}
```

Response multipart:

```json
{
  "data": {
    "id": "upload-session-id",
    "itemId": "placeholder-item-id",
    "method": "multipart",
    "status": "pending",
    "partSize": 10485760,
    "partCount": 5,
    "expiresAt": "2026-07-29T06:00:00.000Z"
  }
}
```

Backend thực hiện atomically hoặc có compensation:

```text
validate parent/item
reserve quota
create uploading placeholder
create upload_session
reserve opaque object key
```

---

## 6.3. Lấy trạng thái upload

```http
GET /api/v1/upload-sessions/:uploadSessionId
```

Dùng sau reload hoặc retry frontend.

---

## 6.4. Lấy signed URL cho multipart parts

```http
POST /api/v1/upload-sessions/:uploadSessionId/part-urls
```

Body:

```json
{
  "partNumbers": [1, 2, 3, 4]
}
```

Response:

```json
{
  "data": [
    {
      "partNumber": 1,
      "url": "signed-url"
    }
  ]
}
```

Không cấp toàn bộ hàng nghìn URL cùng lúc.

---

## 6.5. Đăng ký một uploaded part

Chỉ cần khi ứng dụng thực sự dùng `upload_parts`:

```http
PUT /api/v1/upload-sessions/:uploadSessionId/parts/:partNumber
```

Body:

```json
{
  "etag": "provider-etag",
  "size": 10485760
}
```

`PUT` làm endpoint này idempotent.

List parts có giới hạn:

```http
GET /api/v1/upload-sessions/:uploadSessionId/parts?cursor=&limit=100
```

Nếu provider completion manifest đủ tin cậy, có thể không mở hai endpoint này.

---

## 6.6. Complete upload

```http
POST /api/v1/upload-sessions/:uploadSessionId/complete
Idempotency-Key: <uuid>
```

Multipart body:

```json
{
  "parts": [
    {
      "partNumber": 1,
      "etag": "etag-1"
    }
  ]
}
```

Response thường:

```http
202 Accepted
```

```json
{
  "data": {
    "uploadSessionId": "upload-session-id",
    "itemId": "file-id",
    "status": "processing"
  }
}
```

Finalize idempotent:

```text
verify object
calculate/verify checksum
detect MIME by signature
scan
attach/create scoped blob
allocate version number
insert immutable file_version
activate drive_item
commit quota
write outbox
```

---

## 6.7. Abort upload

```http
DELETE /api/v1/upload-sessions/:uploadSessionId
```

Backend:

```text
abort multipart
remove temp object
release quota exactly once
mark placeholder failed/remove
mark session aborted
```

---

## 6.8. Collection liên quan

```text
upload_sessions
upload_parts
quota_accounts
quota_transactions
drive_items
file_versions
file_blobs
outbox_events
idempotency_keys
```

---

# 7. Phase 4 — File Content, Preview và Versions

## 7.1. Download current version

```http
GET /api/v1/files/:fileId/content
```

Header hỗ trợ:

```http
Range: bytes=0-1048575
If-None-Match: "<etag>"
```

Response:

```http
200 OK
206 Partial Content
304 Not Modified
```

Download attachment:

```http
GET /api/v1/files/:fileId/content?disposition=attachment
```

Inline:

```http
GET /api/v1/files/:fileId/content?disposition=inline
```

---

## 7.2. HEAD current version

```http
HEAD /api/v1/files/:fileId/content
```

Trả:

```text
Content-Length
Content-Type
ETag
Last-Modified
Accept-Ranges
Content-Disposition
```

---

## 7.3. Preview

```http
GET /api/v1/files/:fileId/preview
```

Query tùy chọn:

```http
GET /api/v1/files/:fileId/preview?width=1200&page=1
```

MVP:

```text
image → inline
PDF → inline/range
text → bounded snippet
unsupported → 415 hoặc preview status
```

---

## 7.4. List versions

```http
GET /api/v1/files/:fileId/versions?cursor=&limit=50
```

Sort:

```text
versionNumber DESC
```

---

## 7.5. Version detail

```http
GET /api/v1/files/:fileId/versions/:versionId
```

---

## 7.6. Download một version cũ

```http
GET /api/v1/files/:fileId/versions/:versionId/content
```

```http
HEAD /api/v1/files/:fileId/versions/:versionId/content
```

---

## 7.7. Restore version

```http
POST /api/v1/files/:fileId/versions/:versionId/restore
Idempotency-Key: <uuid>
```

Không đổi trực tiếp current version về version cũ.

Nên:

```text
lấy blob của version cũ
→ tạo một file_version mới
→ đặt version mới thành current
```

Lịch sử vẫn immutable.

---

## 7.8. Không mở endpoint trực tiếp cho blob

Không có:

```text
GET /file-blobs/:blobId
GET /file-blobs/:blobId/object
```

Client chỉ truy cập nội dung qua `fileId` và permission.

---

# 8. Phase 5 — Permission và Sharing

## 8.1. Mục tiêu

Hoàn thành:

- Share user đã tồn tại.
- Invite email chưa có tài khoản.
- Public link.
- Permission inheritance qua `ancestorIds`.
- Shared with me.
- Public folder browsing.
- Revoke không copy ACE xuống descendant.

---

## 8.2. Tìm user để share

```http
GET /api/v1/users?query=alice&limit=10
```

Chỉ trả public fields tối thiểu:

```text
id
username
name
avatarUrl
```

Không trả email tùy tiện nếu policy không cho phép.

---

## 8.3. List permission trực tiếp của item

```http
GET /api/v1/drive/items/:itemId/permissions?cursor=&limit=50
```

Không trả permission inherited như các row giả.

Có thể trả hai phần:

```json
{
  "data": {
    "direct": [],
    "inheritedFrom": []
  }
}
```

---

## 8.4. Tạo direct permission

```http
POST /api/v1/drive/items/:itemId/permissions
Idempotency-Key: <uuid>
```

Body:

```json
{
  "granteeUserId": "user-id",
  "role": "viewer",
  "canDownload": true
}
```

---

## 8.5. Update permission

```http
PATCH /api/v1/drive/permissions/:permissionId
If-Match: "<permission-version>"
```

Body:

```json
{
  "role": "editor",
  "canDownload": true
}
```

---

## 8.6. Revoke permission

```http
DELETE /api/v1/drive/permissions/:permissionId
```

---

## 8.7. Tạo invitation

```http
POST /api/v1/drive/items/:itemId/invitations
Idempotency-Key: <uuid>
```

Body:

```json
{
  "inviteeEmail": "new-user@example.com",
  "role": "viewer",
  "expiresAt": "2026-08-29T00:00:00.000Z"
}
```

List:

```http
GET /api/v1/drive/items/:itemId/invitations?status=pending&cursor=&limit=50
```

Revoke:

```http
DELETE /api/v1/drive/invitations/:invitationId
```

Accept:

```http
POST /api/v1/drive/invitations/:invitationId/accept
```

Accept tạo `drive_permissions` row và cập nhật invitation.

---

## 8.8. Tạo public share link

```http
POST /api/v1/drive/items/:itemId/share-links
Idempotency-Key: <uuid>
```

Body:

```json
{
  "canDownload": true,
  "password": null,
  "expiresAt": null
}
```

Response chỉ trả raw token **một lần**:

```json
{
  "data": {
    "id": "share-link-id",
    "url": "https://app.example.com/s/raw-token",
    "canDownload": true,
    "passwordProtected": false,
    "expiresAt": null
  }
}
```

Database chỉ lưu token hash.

---

## 8.9. List public links của item

```http
GET /api/v1/drive/items/:itemId/share-links?cursor=&limit=50
```

---

## 8.10. Update public link

```http
PATCH /api/v1/drive/share-links/:shareLinkId
```

Body:

```json
{
  "canDownload": false,
  "expiresAt": "2026-08-01T00:00:00.000Z"
}
```

---

## 8.11. Revoke public link

```http
DELETE /api/v1/drive/share-links/:shareLinkId
```

---

## 8.12. Shared with me

```http
GET /api/v1/drive/shared-with-me?cursor=&limit=50
```

Dùng projection `shared_with_me`, không scan toàn bộ permissions.

---

## 8.13. Public link metadata

```http
GET /api/v1/public/share-links/:token
```

Not found, revoked và expired nên cùng trả:

```http
404 LINK_NOT_FOUND
```

---

## 8.14. Password-protected link

```http
POST /api/v1/public/share-links/:token/access
```

Body:

```json
{
  "password": "shared-password"
}
```

Có thể trả short-lived access cookie/token cho public session.

---

## 8.15. Public file content

```http
GET /api/v1/public/share-links/:token/content
HEAD /api/v1/public/share-links/:token/content
```

Chỉ cho download khi:

```text
link valid
password access valid
canDownload = true
blob scanState = clean
```

---

## 8.16. Public folder browsing

```http
GET /api/v1/public/share-links/:token/items?parentId=&cursor=&limit=50
```

Backend phải bảo đảm `parentId` nằm trong subtree của item được share.

---

## 8.17. Collection liên quan

```text
drive_permissions
share_links
share_invitations
shared_with_me
drive_items
outbox_events
```

---

# 9. Phase 6 — Personal Drive Views

## 9.1. User state của item

```http
GET /api/v1/drive/items/:itemId/user-state
```

```http
PATCH /api/v1/drive/items/:itemId/user-state
```

Body:

```json
{
  "isStarred": true,
  "isPinned": false,
  "isHidden": false
}
```

State nằm trong `user_item_states`, không ghi vào `drive_items`.

---

## 9.2. Starred

```http
GET /api/v1/drive/starred?cursor=&limit=50
```

---

## 9.3. Pinned

```http
GET /api/v1/drive/pinned?cursor=&limit=50
```

---

## 9.4. Recent

```http
GET /api/v1/drive/recent?cursor=&limit=50
```

Không ghi một MongoDB update cho mỗi click.

Luồng:

```text
open/list/download
→ enqueue/buffer Redis event
→ batch flush user_item_activities
```

---

## 9.5. Shortcuts

Create:

```http
POST /api/v1/drive/shortcuts
```

Body:

```json
{
  "targetItemId": "item-id",
  "parentId": null,
  "name": "Backend shortcut"
}
```

Update shortcut:

```http
PATCH /api/v1/drive/shortcuts/:shortcutId
```

Delete shortcut:

```http
DELETE /api/v1/drive/shortcuts/:shortcutId
```

List shortcut:

```http
GET /api/v1/drive/shortcuts?parentId=&cursor=&limit=50
```

Không cho shortcut chain vô hạn; shortcut phải resolve tới target item thật.

---

# 10. Phase 7 — Search, Quota và Activity

## 10.1. Search Drive

```http
GET /api/v1/drive/search?q=report&type=file&scope=all&cursor=&limit=50
```

Query:

| Query       | Giá trị                     |
| ----------- | --------------------------- |
| `q`         | search text                 |
| `scope`     | `my_drive`, `shared`, `all` |
| `type`      | file/folder                 |
| `mimeType`  | optional                    |
| `extension` | optional                    |
| `cursor`    | cursor                      |
| `limit`     | tối đa 100                  |

Dùng `search_documents` projection.

Không query bằng cách:

```text
load toàn bộ permission
→ load toàn bộ item
→ filter trong memory
```

---

## 10.2. Quota hiện tại

```http
GET /api/v1/users/me/quota
```

Response:

```json
{
  "data": {
    "quotaBytes": 10737418240,
    "usedBytes": 524288000,
    "reservedBytes": 104857600,
    "availableBytes": 10108272640
  }
}
```

Không public hóa:

```text
POST /quota/reserve
POST /quota/commit
POST /quota/release
```

Đây là internal service operations của upload workflow.

---

## 10.3. Activity của item

```http
GET /api/v1/drive/items/:itemId/activities?cursor=&limit=50
```

---

## 10.4. Activity feed của user

```http
GET /api/v1/users/me/activities?cursor=&limit=50
```

---

## 10.5. Collection liên quan

```text
search_documents
quota_accounts
quota_transactions
item_activities
user_item_activities
outbox_events
```

---

# 11. Phase 8 — Operations, Health và Audit

## 11.1. Operations

Đã có từ Phase 2:

```http
GET /api/v1/operations
GET /api/v1/operations/:operationId
```

Không cho client chỉnh trực tiếp:

```text
status
progress
checkpoint
lease
retryCount
```

Worker quản lý các field này.

Có thể thêm retry có kiểm soát cho job failed:

```http
POST /api/v1/operations/:operationId/retry
```

Chỉ owner hoặc admin và chỉ với operation cho phép retry.

---

## 11.2. Health

Liveness:

```http
GET /api/v1/health/live
```

Readiness:

```http
GET /api/v1/health/ready
```

Readiness kiểm tra tối thiểu:

```text
MongoDB
Redis/BullMQ
MinIO/S3 metadata call
outbox relay health
worker heartbeat
```

Không thực hiện upload/download thật trong mỗi readiness request.

---

## 11.3. Admin audit

```http
GET /api/v1/admin/audit-logs?actorId=&itemId=&action=&cursor=&limit=100
```

```http
GET /api/v1/admin/security-audit-events?userId=&event=&cursor=&limit=100
```

Yêu cầu admin guard riêng.

---

## 11.4. Reconciliation status

Không bắt buộc public.

Có thể thêm admin endpoint:

```http
GET /api/v1/admin/reconciliation/status
```

Cho biết:

```text
orphan upload sessions
orphan versions
blob refCount drift
quota drift
outbox backlog
GC backlog
```

---

# 12. Phase 9 — Scale Hardening

Phase này chủ yếu không thêm public endpoint mới.

## 12.1. Bắt buộc trên API hiện có

- Cursor pagination.
- `Idempotency-Key`.
- `If-Match`/version.
- Projection nhỏ.
- `Range` download.
- `ETag`.
- Request ID.
- Structured error code.
- Rate limit theo nhóm endpoint.
- Timeout và cancellation.
- Async `202` cho recursive operation.
- Capabilities trong list response để frontend không gọi permission N+1.
- Không expose `ancestorIds`, `blobId`, `bucket`, `objectKey`.

## 12.2. Benchmark endpoint nóng

```text
GET /drive/items
GET /drive/items/:id
PATCH /drive/items/:id
POST /drive/folders
POST /upload-sessions
POST /upload-sessions/:id/complete
GET /files/:id/content
GET /drive/shared-with-me
GET /drive/search
GET /drive/trash
```

## 12.3. Không shard core chỉ vì endpoint nhiều

Giữ core trên replica set cho tới khi benchmark chứng minh cần shard:

```text
drive_items
file_versions
file_blobs
upload_sessions
drive_permissions
quota_accounts
outbox_events
```

---

# 13. API MVP bắt buộc

Đây là nhóm nên làm trước để frontend Drive chạy được.

## Phase MVP-A — Folder

```text
GET    /api/v1/drive/items
GET    /api/v1/drive/items/:itemId
POST   /api/v1/drive/folders
GET    /api/v1/drive/folders/:folderId/breadcrumb
PATCH  /api/v1/drive/items/:itemId
DELETE /api/v1/drive/items/:itemId
```

## Phase MVP-B — File

```text
POST   /api/v1/upload-sessions
GET    /api/v1/upload-sessions/:uploadSessionId
POST   /api/v1/upload-sessions/:uploadSessionId/complete
DELETE /api/v1/upload-sessions/:uploadSessionId

GET    /api/v1/files/:fileId/content
HEAD   /api/v1/files/:fileId/content
GET    /api/v1/files/:fileId/preview
```

## Phase MVP-C — Trash/Operation

```text
GET    /api/v1/drive/trash
POST   /api/v1/drive/trash/:itemId/restore
DELETE /api/v1/drive/trash/:itemId

GET    /api/v1/operations/:operationId
```

Tổng core MVP:

```text
14 endpoints
```

Không tính Auth.

---

# 14. API Production Complete

```text
Auth/User                         9
Drive/Folder core                7
Trash/Recursive operations       6
Upload sessions                  7
File content/version             8
Permissions/Sharing             16
Personal views/shortcuts         8
Search/Quota/Activity            4
Health/Admin                     4+
```

Không cần triển khai toàn bộ cùng lúc.

Thứ tự đúng:

```text
Drive folder correctness
→ recursive operation safety
→ upload correctness
→ download/version
→ sharing permission
→ personal/search projections
→ audit/scale
```

---

# 15. Controller và Module Mapping

```text
AuthController
UsersController

DriveItemsController
FoldersController
TrashController

UploadSessionsController
FilesController
FileVersionsController

PermissionsController
ShareLinksController
ShareInvitationsController
PublicShareLinksController

PersonalDriveController
ShortcutsController
SearchController
ActivitiesController
QuotaController

OperationsController
HealthController
AdminAuditController
```

Module:

```text
AuthModule
UsersModule

DriveModule
FoldersModule
TrashModule

StorageModule
UploadsModule
FilesModule
FileVersionsModule
BlobsModule        # internal service, không cần public controller

PermissionsModule
SharesModule

UserItemStatesModule
ActivitiesModule
SearchModule
QuotaModule

OperationsModule
OutboxModule       # internal
HealthModule
AuditModule
```

---

# 16. Chuẩn status code

| Tình huống                     | Status |
| ------------------------------ | ------ |
| Read success                   | `200`  |
| Create resource                | `201`  |
| Async work queued              | `202`  |
| Delete/revoke không body       | `204`  |
| DTO/query sai                  | `400`  |
| Access token sai/hết hạn       | `401`  |
| Không có quyền                 | `403`  |
| Không tìm thấy                 | `404`  |
| Version `If-Match` sai         | `412`  |
| Trùng tên/cycle/state conflict | `409`  |
| File quá lớn                   | `413`  |
| MIME không hỗ trợ              | `415`  |
| Rule nghiệp vụ không hợp lệ    | `422`  |
| Hết quota                      | `507`  |
| Rate limit                     | `429`  |
| Storage/DB tạm lỗi             | `503`  |

---

# 17. Chuẩn error code tối thiểu

```text
VALIDATION_FAILED

AUTH_INVALID_CREDENTIALS
AUTH_TOKEN_EXPIRED
AUTH_REFRESH_TOKEN_REUSED

DRIVE_ITEM_NOT_FOUND
DRIVE_ITEM_NAME_CONFLICT
DRIVE_ITEM_VERSION_CONFLICT
DRIVE_ITEM_OPERATION_IN_PROGRESS
DRIVE_ITEM_INVALID_PARENT
DRIVE_ITEM_MOVE_CYCLE
DRIVE_MAX_DEPTH_EXCEEDED

UPLOAD_SESSION_NOT_FOUND
UPLOAD_SESSION_EXPIRED
UPLOAD_SESSION_ALREADY_COMPLETED
UPLOAD_CHECKSUM_MISMATCH
UPLOAD_FINALIZE_FAILED

FILE_NOT_READY
FILE_INFECTED
FILE_PREVIEW_UNSUPPORTED

PERMISSION_DENIED
SHARE_LINK_NOT_FOUND
INVITATION_NOT_FOUND

INSUFFICIENT_STORAGE
IDEMPOTENCY_KEY_REUSED
OPERATION_NOT_FOUND
```

---

# 18. Kết luận triển khai

Luồng API nên được phát triển theo đúng chuỗi phụ thuộc:

```text
Auth
→ Drive list
→ Folder create
→ Item detail
→ Rename/move
→ Soft delete
→ Trash + operations
→ Upload session
→ File finalize
→ Content/preview/version
→ Permission/share
→ Search/recent/starred
→ Audit/benchmark
```

Điểm quan trọng:

```text
drive_items
→ không mang storage key

file_versions
→ lịch sử immutable

file_blobs
→ internal physical object metadata

upload_sessions
→ lifecycle upload

processing_jobs
→ recursive operation

outbox_events
→ đồng bộ projection/worker

permissions
→ resolve self + ancestors
```

Không tạo public CRUD cho mọi collection. Public API phải bám theo nghiệp vụ người dùng, còn internal collections được thao tác qua service và worker.
