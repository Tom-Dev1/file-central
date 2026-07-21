# File Central — API Reference & Data Types (cho Frontend)

Base URL mặc định: `http://localhost:3000` Swagger UI (tương tác trực tiếp): `http://localhost:3000/docs`

Mọi endpoint có 🔒 cần header:

```
Authorization: Bearer <accessToken>
```

---

## 1. TypeScript Types dùng chung

Copy nguyên khối này vào `types/api.ts` của frontend — khớp chính xác với response thật của backend (đã map qua DTO, không có `objectKey`/`bucket`/`__v`).

```ts
// ---------- Enums ----------
export type DriveItemKind = "file" | "folder";
export type SharePermission = "view" | "download" | "edit";
export type ShareType = "user" | "public_link";

// ---------- Core entities ----------
export interface DriveItem {
  id: string;
  name: string;
  type: DriveItemKind;
  mimeType?: string; // chỉ có ở file
  size?: number; // bytes, chỉ có ở file
  extension?: string; // chỉ có ở file, không kèm dấu chấm ("pdf" không phải ".pdf")
  ownerId: string;
  parentId: string | null; // null = ở root
  isDeleted: boolean; // true = đang trong Trash
  deletedAt?: string | null; // ISO date string
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export interface Share {
  id: string;
  itemId: string;
  itemType: DriveItemKind;
  ownerId: string;
  sharedWithUserId: string | null;
  sharedWithEmail?: string | null;
  permission: SharePermission;
  shareType: ShareType;
  token?: string | null; // chỉ có ở shareType = 'public_link'
  expiresAt?: string | null; // ISO date string
  isRevoked: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
}

// ---------- Wrappers ----------
export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AuthResponse {
  accessToken: string; // hết hạn sau 15 phút (mặc định)
  refreshToken: string; // hết hạn sau 30 ngày, chỉ dùng để gọi /auth/refresh
  user: User;
}

// ---------- Error shape (mọi lỗi 4xx/5xx đều có dạng này) ----------
export interface ApiErrorResponse {
  statusCode: number;
  path: string;
  timestamp: string; // ISO date string
  message: string | string[]; // string[] khi lỗi validation (class-validator) trả nhiều lỗi field
  error?: string; // ví dụ "Bad Request", "Not Found"...
}
```

---

## 2. Auth

### `POST /auth/register`

Rate limit: 5 request/phút/IP.

```ts
// Request body
interface RegisterRequest {
  email: string;
  name: string;
  password: string; // tối thiểu 6 ký tự
}

// Response 201
type RegisterResponse = AuthResponse;
```

### `POST /auth/login`

Rate limit: 5 request/phút/IP.

```ts
interface LoginRequest {
  email: string;
  password: string;
}

type LoginResponse = AuthResponse;
// Lỗi: 401 nếu sai email/password
```

### `POST /auth/refresh`

Không cần Bearer token — dùng chính `refreshToken` để lấy cặp token mới (refresh token cũ sẽ bị vô hiệu, đây gọi là "rotation").

```ts
interface RefreshRequest {
  refreshToken: string;
}

interface RefreshResponse {
  accessToken: string;
  refreshToken: string; // token MỚI — frontend phải lưu đè lên token cũ
}
// Lỗi: 401 nếu refreshToken không hợp lệ / đã hết hạn / đã bị revoke
```

### `POST /auth/logout`

```ts
interface LogoutRequest {
  refreshToken: string;
}
interface LogoutResponse {
  loggedOut: true;
}
```

### `POST /auth/logout-all`

Revoke toàn bộ refresh token của user (đăng xuất mọi thiết bị). Không cần body.

```ts
interface LogoutAllResponse {
  loggedOutAllDevices: true;
}
```

---

## 3. Folders

### `POST /folders` 🔒

```ts
interface CreateFolderRequest {
  name: string;
  parentId?: string | null; // bỏ trống = tạo ở root
}

// Response 201
type CreateFolderResponse = DriveItem; // type luôn = 'folder'
```

---

## 4. Files

### `POST /files/upload` 🔒

Gửi dạng `multipart/form-data`, KHÔNG phải JSON.

```ts
// Form fields:
//   file: File            (bắt buộc)
//   parentId: string       (optional, để trống nếu upload vào root)

// Ví dụ dùng fetch:
async function uploadFile(file: File, parentId?: string, accessToken?: string) {
  const form = new FormData();
  form.append("file", file);
  if (parentId) form.append("parentId", parentId);

  const res = await fetch("http://localhost:3000/files/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form, // KHÔNG tự set Content-Type, để browser tự thêm boundary
  });
  return res.json() as Promise<DriveItem>;
}
```

Giới hạn dung lượng mặc định: 200MB (cấu hình qua `MAX_UPLOAD_SIZE_MB` ở backend).

### `GET /files/:id/download` 🔒

Không phải JSON — trả về file binary trực tiếp kèm header:

```
Content-Type: <mimeType thật của file>
Content-Disposition: attachment; filename="<tên file>"
```

Frontend xử lý bằng cách tạo link tải, ví dụ:

```ts
function downloadFile(fileId: string, accessToken: string) {
  // Cách đơn giản nhất: mở tab mới kèm token qua header không khả thi với thẻ <a>,
  // nên thường dùng fetch + blob:
  fetch(`http://localhost:3000/files/${fileId}/download`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
    .then((res) => res.blob())
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = ""; // browser tự lấy tên từ Content-Disposition
      a.click();
      URL.revokeObjectURL(url);
    });
}
```

Yêu cầu quyền tối thiểu: `download` (owner hoặc được share `download`/`edit`).

### `GET /files/:id/preview` 🔒

Giống download nhưng header là `Content-Disposition: inline` (browser render trực tiếp thay vì tải về) — dùng cho `<img src>` hoặc `<iframe>` xem trước PDF. Yêu cầu quyền tối thiểu: `view` (thấp hơn download).

```tsx
// Ví dụ React hiển thị ảnh preview (cần đính kèm token qua query hoặc
// dùng fetch+blob như trên nếu endpoint yêu cầu Bearer header)
<img src={`/files/${fileId}/preview`} />
```

> Lưu ý: thẻ `<img>` không tự gửi header `Authorization`. Nếu preview cần auth, nên fetch bằng JS lấy blob rồi gán `URL.createObjectURL`, giống cách làm ở `downloadFile` phía trên.

---

## 5. Drive (danh sách / tìm kiếm / rename / move / xoá)

### `GET /drive` 🔒

Liệt kê nội dung trực tiếp trong 1 thư mục (không đệ quy).

```ts
interface ListDriveQuery {
  parentId?: string; // bỏ trống = root
  type?: "file" | "folder"; // bỏ trống = lấy cả 2
  page?: number; // mặc định 1
  limit?: number; // mặc định 50, tối đa 200
}

type ListDriveResponse = PaginatedResponse<DriveItem>;
```

Ví dụ: `GET /drive?parentId=64f...&type=folder&page=1&limit=20`

### `GET /drive/search` 🔒

Tìm theo tên trên **toàn bộ cây** của user (không giới hạn theo `parentId`).

```ts
interface SearchDriveQuery {
  q?: string; // khớp tên, không phân biệt hoa/thường
  type?: "file" | "folder";
  page?: number;
  limit?: number;
}

type SearchDriveResponse = PaginatedResponse<DriveItem>;
```

### `PATCH /drive/:id/rename` 🔒

```ts
interface RenameRequest {
  name: string;
}
type RenameResponse = DriveItem;
// Lỗi: 409 nếu trùng tên trong cùng parent, 403 nếu không đủ quyền edit
```

### `PATCH /drive/:id/move` 🔒

```ts
interface MoveRequest {
  newParentId?: string | null; // null/bỏ trống = move ra root
}
type MoveResponse = DriveItem;
// Lỗi: 400 nếu move folder vào chính nó/con cháu của nó (circular)
```

### `DELETE /drive/:id` 🔒

Soft-delete — chuyển vào Trash (đệ quy nếu là folder).

```ts
interface RemoveResponse {
  deletedIds: string[]; // toàn bộ id đã bị soft-delete, gồm cả con cháu nếu là folder
}
```

---

## 6. Trash

### `GET /trash` 🔒

Chỉ trả về các item là "gốc" của cây đã xoá (giống Google Drive: xoá 1 folder thì chỉ hiện folder đó trong Trash, không hiện từng file con riêng lẻ).

```ts
type TrashListResponse = DriveItem[]; // isDeleted luôn = true
```

### `PATCH /trash/:id/restore` 🔒

```ts
interface RestoreResponse {
  restoredIds: string[]; // id đã khôi phục, gồm cả con cháu nếu là folder
}
// Lỗi: 403 nếu folder cha vẫn còn trong Trash — phải restore folder cha trước
```

### `DELETE /trash/:id` 🔒

Xoá vĩnh viễn 1 item (và cây con nếu là folder) — không thể hoàn tác.

```ts
interface PurgeResponse {
  deletedIds: string[];
}
```

### `DELETE /trash` 🔒

Dọn sạch toàn bộ Trash.

```ts
type PurgeAllResponse = PurgeResponse;
```

---

## 7. Shares

### `POST /shares` 🔒

```ts
interface CreateShareRequest {
  itemId: string;
  shareType: "user" | "public_link";
  permission: SharePermission;
  sharedWithEmail?: string; // bắt buộc nếu shareType = 'user'
  expiresAt?: string | null; // ISO date string, optional
}

type CreateShareResponse = Share;
// Lỗi: 403 nếu không phải owner của item
```

### `GET /shares` 🔒

Danh sách share do chính user tạo (owner).

```ts
type ListMySharesResponse = Share[];
```

### `GET /shares/shared-with-me` 🔒

Item được share **trực tiếp** cho user (không bao gồm item nằm sâu bên trong 1 folder được share — dùng endpoint kế tiếp để duyệt vào bên trong).

```ts
interface SharedWithMeRow {
  share: Share;
  item: DriveItem;
}
type SharedWithMeResponse = SharedWithMeRow[];
```

### `GET /shares/shared-with-me/:folderId/items` 🔒

Duyệt vào bên trong 1 folder được share (kiểm tra quyền theo ancestor-chain).

```ts
type SharedFolderChildrenResponse = DriveItem[];
```

### `DELETE /shares/:id` 🔒

Thu hồi 1 share.

```ts
interface RevokeShareResponse {
  revoked: true;
}
```

### `GET /shares/public/:token`

**Không cần** Bearer token — public link ai cũng xem được metadata.

```ts
interface PublicShareMetadataResponse {
  item: DriveItem;
  permission: SharePermission;
}
```

### `GET /shares/public/:token/download`

**Không cần** Bearer token. Trả về file binary (giống `/files/:id/download`), chỉ hoạt động nếu `permission` của share là `download` hoặc `edit`.

---

## 8. Ví dụ 1 API client tối giản (fetch wrapper)

```ts
const BASE_URL = "http://localhost:3000";

let accessToken: string | null = null;
let refreshToken: string | null = null;

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401 && refreshToken) {
    // access token hết hạn -> thử refresh 1 lần rồi gọi lại request gốc
    const refreshed = await apiFetch<{ accessToken: string; refreshToken: string }>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
    accessToken = refreshed.accessToken;
    refreshToken = refreshed.refreshToken;
    return apiFetch<T>(path, options); // retry
  }

  if (!res.ok) {
    const error: ApiErrorResponse = await res.json();
    throw error;
  }
  return res.json();
}

// Sử dụng:
const folder = await apiFetch<DriveItem>("/folders", {
  method: "POST",
  body: JSON.stringify({ name: "Documents" }),
});

const listing = await apiFetch<PaginatedResponse<DriveItem>>(`/drive?parentId=${folder.id}&page=1&limit=50`);
```

---

## 9. Ghi chú quan trọng cho frontend

- **`parentId` gốc là `null`**, không phải chuỗi rỗng `""`. Khi gọi API list/search/create ở root, bỏ hẳn field `parentId` ra khỏi query/body thay vì gửi `""`.
- **Ngày giờ trả về dạng ISO string** (`"2026-07-16T10:23:00.000Z"`), tự parse bằng `new Date(...)` ở frontend.
- **Access token chỉ sống 15 phút** — bắt buộc phải implement luồng gọi `/auth/refresh` tự động khi gặp lỗi 401 (xem ví dụ mục 8), nếu không user sẽ bị văng ra liên tục.
- **Upload/download không dùng JSON** — nhớ dùng `FormData` khi upload, và xử lý `blob` khi download, đừng gọi `res.json()` cho 2 endpoint này.
- **Thứ tự sort mặc định của `/drive`**: folder luôn đứng trước file, trong mỗi nhóm sort theo tên A-Z.
