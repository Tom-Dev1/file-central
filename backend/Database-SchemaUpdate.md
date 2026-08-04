# File Central — Database Schema

Version: 3.0

Database: MongoDB

Backend: NestJS + Mongoose

This document defines the database model for File Central after narrowing the product scope to file and folder management.

---

## 0. Product scope and fixed decisions

File Central is a file asset manager. It stores files and manages their logical metadata and folder hierarchy.

### Supported operations

- Upload and create files.
- Create folders.
- List and open folders.
- Preview files in read-only mode.
- Download files.
- Rename files and folders.
- Move files and folders.
- Star and unstar items.
- Move items to Trash.
- Restore items from Trash.
- Delete items permanently.
- Share items when the sharing phase is enabled.

### Explicitly out of scope

- Editing Word, Excel, PDF, image, video, or other file content.
- Collaborative editing.
- Auto-save.
- Content diff or merge.
- Content-version history.
- Restoring an older content version.
- Multiple physical versions of one logical file.

The binary content of an uploaded file is immutable. Rename, move, star, share, Trash, and restore update metadata only. They must not rename or move the object inside MinIO/S3.

### Schema decisions

1. MongoDB `_id: ObjectId` is the only identifier for each document.
2. The API serializes `_id` as `id: string`.
3. References such as `ownerId`, `parentId`, and `storageObjectId` use `ObjectId`, not UUID strings.
4. One logical file references one `storage_objects` document.
5. There is no `file_versions` collection.
6. `metadataVersion` protects metadata updates; it is not a file-content version.
7. `operationState`, `operationId`, and `processing_jobs` are not part of the initial schema. They are introduced only when measured subtree sizes require asynchronous recursive operations.
8. The initial production topology is a MongoDB replica set. Core sharding is a later, measurement-driven decision.

---

## 1. Datatype conventions

### 1.1. Storage and TypeScript mapping

| Purpose | MongoDB/BSON type | NestJS/Mongoose type | API representation | Rule |
| --- | --- | --- | --- | --- |
| Primary key | `ObjectId` | `Types.ObjectId` | `string` | Use MongoDB-generated `_id`; do not add a second `id` field. |
| Document reference | `ObjectId` | `Types.ObjectId` | `string` | All related collections must use the same ID type. |
| Text | `String` | `string` | `string` | Apply length and normalization validation. |
| Enum | `String` | string enum | `string` | Store stable lowercase values. |
| Flag | `Boolean` | `boolean` | `boolean` | Do not use `0/1` for boolean state. |
| Timestamp | `Date` | `Date` | ISO-8601 string | Store UTC. |
| Small count/version | `Int32` | `number` | `number` | Non-negative integer; suitable for counters below 2,147,483,647. |
| Byte size/quota | `Int64` | `bigint` | decimal string | Prevent precision loss for large byte counters. |
| SHA-256 digest | `Binary(32)` | `Buffer` | normally not exposed | Avoid a 64-character hexadecimal value in storage/indexes. |
| IP address | `String` | `string` | `string` | Validate IPv4/IPv6; do not model as a number. |
| Bounded metadata | embedded document | typed object | JSON object | Define known fields; avoid unbounded `Mixed` data. |

MongoDB `ObjectId` is appropriate here because the application uses one MongoDB database and does not need client-generated or database-independent IDs. It is 12 bytes, generated automatically, and approximately ordered by creation time.

### 1.2. API ID rule

MongoDB document:

```json
{
  "_id": { "$oid": "6889a0b7f34c8f79ad138d21" },
  "name": "Report.pdf"
}
```

API response:

```json
{
  "id": "6889a0b7f34c8f79ad138d21",
  "name": "Report.pdf"
}
```

Request DTOs validate IDs with `@IsMongoId()`. Services and repositories convert validated strings to `Types.ObjectId` at the persistence boundary.

### 1.3. Integer serialization rule

Fields ending in `Bytes` use BSON `Int64`. JavaScript `bigint` cannot be passed directly to `JSON.stringify()`, so response mappers serialize these fields as base-10 strings:

```json
{
  "sizeBytes": "5242880",
  "quotaBytes": "107374182400"
}
```

If the project intentionally caps every byte value below `Number.MAX_SAFE_INTEGER`, the API may return a number, but the contract must choose one representation and use it consistently.

### 1.4. Timestamp rule

- `createdAt`: document creation.
- `updatedAt`: any physical update to the document.
- `lastModifiedAt`: user-visible metadata change only.
- Child-count reconciliation must not change `lastModifiedAt`.
- All timestamps are UTC `Date` values in MongoDB and ISO-8601 strings in JSON.

---

## 2. Collection rollout

| Collection           | Phase                | Purpose                                                          |
| -------------------- | -------------------- | ---------------------------------------------------------------- |
| `users`              | Core                 | Account identity and status.                                     |
| `user_sessions`      | Core                 | Active login sessions and revocation.                            |
| `refresh_tokens`     | Core                 | Rotating, hashed refresh tokens.                                 |
| `drive_items`        | Core                 | File/folder metadata and hierarchy.                              |
| `storage_objects`    | Core                 | Internal physical-object location and immutable binary metadata. |
| `upload_sessions`    | Core                 | Recoverable upload lifecycle.                                    |
| `upload_parts`       | Optional             | Multipart resume data when provider metadata is insufficient.    |
| `user_item_states`   | Core if Star exists  | User-specific star/pin state.                                    |
| `quota_accounts`     | Core if quota exists | Atomic used/reserved byte counters.                              |
| `quota_transactions` | Recommended          | Quota reconciliation ledger.                                     |
| `drive_permissions`  | Sharing phase        | Explicit user access.                                            |
| `share_links`        | Sharing phase        | Public, hashed link tokens.                                      |
| `item_activities`    | Optional             | User-facing activity history.                                    |
| `audit_logs`         | Optional             | Immutable security/compliance history.                           |
| `idempotency_keys`   | Recommended          | Safe replay of upload and mutation requests.                     |
| `search_documents`   | Scale/search phase   | Asynchronous search projection.                                  |

Do not create optional collections or indexes before their feature is enabled.

---

## 3. `users`

**Purpose:** user identity, authentication state, and profile data.

| Field | Type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| `_id` | ObjectId | no | MongoDB | Primary key. |
| `email` | String | no | — | Lowercase and trimmed. |
| `username` | String | no | — | Store normalized lowercase value if login is case-insensitive. |
| `displayName` | String | no | — | User-visible value. |
| `passwordHash` | String | no | — | Argon2id hash; never serialize. |
| `avatarUrl` | String | yes | null | Optional public or signed URL reference. |
| `status` | enum `active\|locked\|disabled` | no | `active` | Access state. |
| `failedLoginCount` | Int32 | no | 0 | Reset after successful login. |
| `lockedUntil` | Date | yes | null | Temporary lock expiry. |
| `createdAt` | Date | no | now | Mongoose timestamps. |
| `updatedAt` | Date | no | now | Mongoose timestamps. |

**Indexes**

```js
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
```

---

## 4. `user_sessions`

**Purpose:** list and revoke authenticated devices/sessions.

| Field        | Type     | Nullable | Default | Notes                                      |
| ------------ | -------- | -------- | ------- | ------------------------------------------ |
| `_id`        | ObjectId | no       | MongoDB | Session ID.                                |
| `userId`     | ObjectId | no       | —       | Reference → `users._id`.                   |
| `deviceName` | String   | yes      | null    | Bounded display value.                     |
| `userAgent`  | String   | yes      | null    | Bounded; do not index.                     |
| `ipAddress`  | String   | yes      | null    | Validated IPv4/IPv6.                       |
| `lastSeenAt` | Date     | no       | now     | Update with throttling, not every request. |
| `revokedAt`  | Date     | yes      | null    | Non-null means revoked.                    |
| `createdAt`  | Date     | no       | now     |                                            |
| `expiresAt`  | Date     | no       | —       | Application check plus TTL cleanup.        |

```js
db.user_sessions.createIndex({ userId: 1, revokedAt: 1, lastSeenAt: -1, _id: -1 });
db.user_sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

---

## 5. `refresh_tokens`

**Purpose:** refresh-token rotation and reuse detection.

| Field       | Type       | Nullable | Default   | Notes                                                |
| ----------- | ---------- | -------- | --------- | ---------------------------------------------------- |
| `_id`       | ObjectId   | no       | MongoDB   |                                                      |
| `userId`    | ObjectId   | no       | —         | Reference → `users._id`.                             |
| `sessionId` | ObjectId   | no       | —         | Reference → `user_sessions._id`.                     |
| `familyId`  | ObjectId   | no       | generated | Rotation lineage.                                    |
| `tokenHash` | Binary(32) | no       | —         | SHA-256 of the raw token. Never store the raw token. |
| `usedAt`    | Date       | yes      | null      | Set when rotated.                                    |
| `revokedAt` | Date       | yes      | null      | Set on session/family revoke.                        |
| `expiresAt` | Date       | no       | —         | Must be checked by application.                      |
| `createdAt` | Date       | no       | now       |                                                      |

```js
db.refresh_tokens.createIndex({ tokenHash: 1 }, { unique: true });
db.refresh_tokens.createIndex({ familyId: 1 });
db.refresh_tokens.createIndex({ sessionId: 1, revokedAt: 1 });
db.refresh_tokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

---

## 6. `drive_items`

**Purpose:** logical file/folder metadata and hierarchy. This collection never stores `bucket`, `objectKey`, raw file bytes, or file-content history.

### 6.1. Fields

| Field | Type | Nullable | Default | Applies to | Notes |
| --- | --- | --- | --- | --- | --- |
| `_id` | ObjectId | no | MongoDB | both | Primary key; serialized as `id`. |
| `ownerId` | ObjectId | no | — | both | Reference → `users._id`; scope every hierarchy query by owner. |
| `parentId` | ObjectId | yes | null | both | Reference → `drive_items._id`; null means root. |
| `ancestorIds` | ObjectId[] | no | `[]` | both | Root to direct parent; bounded by `MAX_FOLDER_DEPTH`. |
| `name` | String | no | — | both | User-visible name after allowed trim policy. |
| `normalizedName` | String | no | — | both | NFC + case-fold normalization; never serialize. |
| `type` | enum `file\|folder` | no | — | both | Discriminator. |
| `storageObjectId` | ObjectId | yes | null | file | Reference → `storage_objects._id`; null during upload/failure. |
| `fileStatus` | enum `uploading\|processing\|active\|failed` | yes | null | file | Null for folders. |
| `mimeType` | String | yes | null | file | Server-detected current MIME type. |
| `sizeBytes` | Int64 | yes | null | file | Immutable after activation. |
| `extension` | String | yes | null | file | Lowercase display/filter value without leading dot. |
| `childCount` | Int32 | yes | null | folder | Approximate count of direct, non-trashed children. |
| `isTrashed` | Boolean | no | false | both | Soft-delete/Trash state; not permanent deletion. |
| `trashedAt` | Date | yes | null | both | Must agree with `isTrashed`. |
| `metadataVersion` | Int32 | no | 1 | both | Optimistic concurrency for metadata only. |
| `createdAt` | Date | no | now | both | Mongoose timestamps. |
| `updatedAt` | Date | no | now | both | Any document update. |
| `lastModifiedAt` | Date | no | now | both | User-visible metadata change. |

### 6.2. File and folder invariants

**Folder**

- `fileStatus`, `storageObjectId`, `mimeType`, `sizeBytes`, and `extension` are null.
- `childCount` is an `Int32 >= 0`.
- The folder is usable immediately after creation.

**File**

- `childCount` is null.
- `fileStatus="active"` requires non-null `storageObjectId`, `mimeType`, and `sizeBytes`.
- `fileStatus="uploading"|"processing"|"failed"` may have `storageObjectId=null`.
- Once active, binary content, checksum, MIME type, and size are immutable.
- Replacing content is not supported. Uploading different content creates a new file item.

**Hierarchy**

- `parentId=null` requires `ancestorIds=[]`.
- A non-root item requires `ancestorIds[last] == parentId`.
- `ancestorIds` must not contain the item itself.
- Parent and all ancestors must have `type="folder"` and the same `ownerId`.
- Depth must not exceed `MAX_FOLDER_DEPTH`; recommended initial limit: 64.
- A move must reject a destination equal to the item or inside its subtree.

**Trash**

- `isTrashed=false` requires `trashedAt=null`.
- `isTrashed=true` requires non-null `trashedAt`.
- Permanent delete removes the metadata document and its storage object.
- Trash/restore of a folder updates its subtree in bounded batches when the subtree is above the synchronous limit.

### 6.3. Baseline indexes

```js
// Default folder list: bounded cursor=(lastModifiedAt,_id).
db.drive_items.createIndex({
  ownerId: 1,
  parentId: 1,
  isTrashed: 1,
  lastModifiedAt: -1,
  _id: -1,
});

// Name-sorted view: folders first, then normalized name.
db.drive_items.createIndex({
  ownerId: 1,
  parentId: 1,
  isTrashed: 1,
  type: -1,
  normalizedName: 1,
  _id: 1,
});

// Reserve one non-trashed name per owner and parent.
db.drive_items.createIndex(
  { ownerId: 1, parentId: 1, normalizedName: 1 },
  {
    unique: true,
    partialFilterExpression: { isTrashed: false },
  }
);

// Breadcrumb, cycle checks, subtree reads, and inherited permission lookup.
db.drive_items.createIndex({
  ownerId: 1,
  ancestorIds: 1,
  isTrashed: 1,
});

// Trash cursor.
db.drive_items.createIndex({
  ownerId: 1,
  isTrashed: 1,
  trashedAt: -1,
  _id: -1,
});

// Recover stale uploads.
db.drive_items.createIndex({
  ownerId: 1,
  fileStatus: 1,
  createdAt: 1,
});
```

Do not add an index on `_id`; MongoDB creates it automatically. Do not add an `id` field or a second unique ID index.

### 6.4. Access complexity

| Operation            | Query/write shape                                    | Expected cost                   |
| -------------------- | ---------------------------------------------------- | ------------------------------- |
| Get item             | `_id + ownerId`                                      | Point lookup.                   |
| List folder          | indexed equality prefix + cursor + limit             | Bounded by page size.           |
| Breadcrumb           | read `ancestorIds`, then one `$in` query             | `O(depth)`, with bounded depth. |
| Rename               | one document + unique-name index                     | Constant-size write.            |
| Move file            | one document                                         | Constant-size write.            |
| Move folder          | root plus descendant `ancestorIds` updates           | `O(subtree size)`.              |
| Trash/restore file   | one document                                         | Constant-size write.            |
| Trash/restore folder | root plus descendants under materialized Trash state | `O(subtree size)`.              |
| Preview/download     | item lookup then storage-object lookup               | Two point reads.                |

Use cursor pagination. Never use a large `skip` for Drive or Trash lists.

### 6.5. Example documents

Folder:

```json
{
  "_id": { "$oid": "6889a0b7f34c8f79ad138d21" },
  "ownerId": { "$oid": "6889a071f34c8f79ad138d01" },
  "parentId": null,
  "ancestorIds": [],
  "name": "Reports",
  "normalizedName": "reports",
  "type": "folder",
  "storageObjectId": null,
  "fileStatus": null,
  "mimeType": null,
  "sizeBytes": null,
  "extension": null,
  "childCount": 2,
  "isTrashed": false,
  "trashedAt": null,
  "metadataVersion": 1,
  "createdAt": "2026-07-10T00:00:00.000Z",
  "updatedAt": "2026-07-10T00:00:00.000Z",
  "lastModifiedAt": "2026-07-10T00:00:00.000Z"
}
```

Active file:

```json
{
  "_id": { "$oid": "6889a0b7f34c8f79ad138d22" },
  "ownerId": { "$oid": "6889a071f34c8f79ad138d01" },
  "parentId": { "$oid": "6889a0b7f34c8f79ad138d21" },
  "ancestorIds": [{ "$oid": "6889a0b7f34c8f79ad138d21" }],
  "name": "Quarterly Report.pdf",
  "normalizedName": "quarterly report.pdf",
  "type": "file",
  "storageObjectId": { "$oid": "6889a2b7f34c8f79ad138d80" },
  "fileStatus": "active",
  "mimeType": "application/pdf",
  "sizeBytes": { "$numberLong": "5242880" },
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

---

## 7. `storage_objects`

**Purpose:** private physical-object metadata for one immutable file. This collection is never serialized directly to clients.

| Field | Type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| `_id` | ObjectId | no | MongoDB | Referenced by `drive_items.storageObjectId`. |
| `ownerId` | ObjectId | no | — | Scope for authorization and cleanup. |
| `provider` | enum `local\|minio\|s3` | no | — | Storage adapter. |
| `bucket` | String | no | — | Internal only. |
| `objectKey` | String | no | — | Opaque, immutable, and unrelated to display name. |
| `sizeBytes` | Int64 | no | — | Verified physical size. |
| `mimeType` | String | no | — | Signature-detected MIME. |
| `checksumSha256` | Binary(32) | no | — | Server-verified SHA-256. |
| `scanStatus` | enum `not_requested\|pending\|clean\|infected\|failed` | no | `not_requested` | `clean` may gate preview/download when scanning is enabled. |
| `state` | enum `active\|deleting\|delete_failed` | no | `active` | Idempotent permanent-delete lifecycle. |
| `createdAt` | Date | no | now |  |
| `updatedAt` | Date | no | now |  |

```js
db.storage_objects.createIndex({ provider: 1, bucket: 1, objectKey: 1 }, { unique: true });
db.storage_objects.createIndex({ ownerId: 1, createdAt: -1, _id: -1 });
db.storage_objects.createIndex({ state: 1, updatedAt: 1, _id: 1 });
```

### Storage rules

- Do not expose `bucket` or `objectKey`.
- Preview/download returns a short-lived signed URL or streams through a protected endpoint.
- Rename and move update only `drive_items`.
- The object key should be random/opaque, for example `objects/{ownerId}/{objectId}`.
- No `refCount` is required because the baseline has one storage object per file.
- No deduplication is performed in the baseline.
- If copy is implemented initially, copy the physical object and create a new storage-object document.
- Cross-file deduplication is a separate later design because it requires reference tracking and safe garbage collection.

---

## 8. `upload_sessions`

**Purpose:** recoverable single-part or multipart upload lifecycle. It creates a file placeholder but never creates a content version.

| Field | Type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| `_id` | ObjectId | no | MongoDB | Upload-session ID. |
| `ownerId` | ObjectId | no | — | Reference → `users._id`. |
| `driveItemId` | ObjectId | no | — | File placeholder in `drive_items`. |
| `parentId` | ObjectId | yes | null | Target-folder snapshot. |
| `method` | enum `single\|multipart` | no | — |  |
| `providerUploadId` | String | yes | null | Provider multipart ID. |
| `temporaryObjectKey` | String | no | — | Internal opaque key. |
| `declaredSizeBytes` | Int64 | no | — | Quota reservation size. |
| `actualSizeBytes` | Int64 | yes | null | Verified on completion. |
| `declaredChecksumSha256` | Binary(32) | yes | null | Client claim; never trusted. |
| `verifiedChecksumSha256` | Binary(32) | yes | null | Server-verified digest. |
| `status` | enum `pending\|uploaded\|processing\|completed\|aborted\|expired\|failed` | no | `pending` |  |
| `idempotencyKey` | String | yes | null | Unique within owner and endpoint intent. |
| `errorCode` | String | yes | null | Stable machine-readable code. |
| `expiresAt` | Date | no | — | Application check plus TTL safety net. |
| `createdAt` | Date | no | now |  |
| `updatedAt` | Date | no | now |  |

```js
db.upload_sessions.createIndex({
  ownerId: 1,
  status: 1,
  createdAt: -1,
  _id: -1,
});
db.upload_sessions.createIndex({
  status: 1,
  expiresAt: 1,
  _id: 1,
});
db.upload_sessions.createIndex(
  { ownerId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
  }
);
db.upload_sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

### Upload state machine

```text
pending
  -> uploaded
  -> processing
  -> completed

pending|uploaded|processing
  -> aborted|expired|failed
```

### Finalization

1. Verify session ownership, state, expiry, file size, checksum, MIME type, and scan policy.
2. Create one `storage_objects` document.
3. Atomically update the placeholder file:
   - `storageObjectId`
   - `fileStatus="active"`
   - `mimeType`
   - `sizeBytes`
   - `extension`
   - `metadataVersion += 1`
   - `lastModifiedAt`
4. Commit reserved quota.
5. Mark the session `completed`.
6. Return the same result for an idempotent retry.

Object-store transfer occurs outside a MongoDB transaction. Short MongoDB transactions may coordinate metadata, quota, and idempotency state on a replica set, but no transaction may remain open while transferring file bytes.

TTL deletion is asynchronous. A reaper must explicitly find expired incomplete sessions, abort provider uploads, delete temporary objects, release reserved quota, and remove or mark failed placeholders.

---

## 9. `upload_parts` — optional

Create this collection only if provider-side multipart metadata is insufficient.

| Field             | Type     | Nullable | Default | Notes                              |
| ----------------- | -------- | -------- | ------- | ---------------------------------- |
| `_id`             | ObjectId | no       | MongoDB |                                    |
| `uploadSessionId` | ObjectId | no       | —       | Reference → `upload_sessions._id`. |
| `partNumber`      | Int32    | no       | —       | Validate provider range.           |
| `etag`            | String   | no       | —       | Provider value.                    |
| `sizeBytes`       | Int64    | yes      | null    |                                    |
| `createdAt`       | Date     | no       | now     |                                    |

```js
db.upload_parts.createIndex({ uploadSessionId: 1, partNumber: 1 }, { unique: true });
```

---

## 10. `user_item_states`

**Purpose:** user-specific UI state. Star state does not belong in a shared `drive_items` document because each user may have a different value.

| Field       | Type     | Nullable | Default |
| ----------- | -------- | -------- | ------- |
| `_id`       | ObjectId | no       | MongoDB |
| `userId`    | ObjectId | no       | —       |
| `itemId`    | ObjectId | no       | —       |
| `isStarred` | Boolean  | no       | false   |
| `isPinned`  | Boolean  | no       | false   |
| `updatedAt` | Date     | no       | now     |

```js
db.user_item_states.createIndex({ userId: 1, itemId: 1 }, { unique: true });
db.user_item_states.createIndex({
  userId: 1,
  isStarred: 1,
  updatedAt: -1,
  _id: -1,
});
```

---

## 11. `quota_accounts`

**Purpose:** atomic per-user storage accounting.

| Field           | Type     | Nullable | Default    | Notes                       |
| --------------- | -------- | -------- | ---------- | --------------------------- |
| `_id`           | ObjectId | no       | MongoDB    |                             |
| `userId`        | ObjectId | no       | —          | One account per user.       |
| `quotaBytes`    | Int64    | no       | plan value | Maximum.                    |
| `usedBytes`     | Int64    | no       | 0          | Active file content.        |
| `reservedBytes` | Int64    | no       | 0          | Active upload reservations. |
| `updatedAt`     | Date     | no       | now        |                             |

```js
db.quota_accounts.createIndex({ userId: 1 }, { unique: true });
```

Required invariants:

- `quotaBytes >= 0`
- `usedBytes >= 0`
- `reservedBytes >= 0`
- `usedBytes + reservedBytes <= quotaBytes`

Reserve quota with one conditional atomic update. Never read the counters and then update them in two independent steps.

---

## 12. `quota_transactions`

**Purpose:** idempotent quota ledger and reconciliation.

| Field             | Type                                    | Nullable | Default |
| ----------------- | --------------------------------------- | -------- | ------- |
| `_id`             | ObjectId                                | no       | MongoDB |
| `userId`          | ObjectId                                | no       | —       |
| `uploadSessionId` | ObjectId                                | yes      | null    |
| `driveItemId`     | ObjectId                                | yes      | null    |
| `type`            | enum `reserve\|commit\|release\|delete` | no       | —       |
| `bytes`           | Int64                                   | no       | —       |
| `idempotencyKey`  | String                                  | no       | —       |
| `createdAt`       | Date                                    | no       | now     |

```js
db.quota_transactions.createIndex({ idempotencyKey: 1 }, { unique: true });
db.quota_transactions.createIndex({ userId: 1, createdAt: -1, _id: -1 });
```

Reconciliation compares `quota_accounts.usedBytes` with the total `sizeBytes` of all files that still own active storage objects, including files in Trash. Storage quota is released only after permanent deletion. Reconciliation does not refer to `file_versions`.

---

## 13. `drive_permissions` — sharing phase

**Purpose:** explicit user access entries. Inheritance uses `ancestorIds`; do not copy permissions onto every descendant.

| Field             | Type                  | Nullable | Default |
| ----------------- | --------------------- | -------- | ------- |
| `_id`             | ObjectId              | no       | MongoDB |
| `itemId`          | ObjectId              | no       | —       |
| `granteeUserId`   | ObjectId              | no       | —       |
| `role`            | enum `viewer\|editor` | no       | —       |
| `canDownload`     | Boolean               | no       | true    |
| `createdById`     | ObjectId              | no       | —       |
| `revokedAt`       | Date                  | yes      | null    |
| `metadataVersion` | Int32                 | no       | 1       |
| `createdAt`       | Date                  | no       | now     |
| `updatedAt`       | Date                  | no       | now     |

Here `editor` means permission to rename, move, organize, or share metadata according to product policy. It does not grant in-browser content editing.

```js
db.drive_permissions.createIndex(
  { itemId: 1, granteeUserId: 1 },
  {
    unique: true,
    partialFilterExpression: { revokedAt: null },
  }
);
db.drive_permissions.createIndex({
  granteeUserId: 1,
  revokedAt: 1,
  updatedAt: -1,
  _id: -1,
});
db.drive_permissions.createIndex({ itemId: 1, revokedAt: 1 });
```

---

## 14. `share_links` — sharing phase

**Purpose:** public read-only links.

| Field          | Type       | Nullable | Default |
| -------------- | ---------- | -------- | ------- |
| `_id`          | ObjectId   | no       | MongoDB |
| `itemId`       | ObjectId   | no       | —       |
| `tokenHash`    | Binary(32) | no       | —       |
| `canDownload`  | Boolean    | no       | true    |
| `passwordHash` | String     | yes      | null    |
| `expiresAt`    | Date       | yes      | null    |
| `revokedAt`    | Date       | yes      | null    |
| `createdById`  | ObjectId   | no       | —       |
| `createdAt`    | Date       | no       | now     |

```js
db.share_links.createIndex({ tokenHash: 1 }, { unique: true });
db.share_links.createIndex({ itemId: 1, revokedAt: 1 });
db.share_links.createIndex(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,
    partialFilterExpression: { expiresAt: { $type: "date" } },
  }
);
```

Only a SHA-256 hash of the random link token is stored. Revoked, expired, and unknown links should return the same public error to avoid an existence oracle.

---

## 15. `item_activities` — optional

**Purpose:** user-facing metadata activity.

| Field | Type | Nullable | Default |
| --- | --- | --- | --- |
| `_id` | ObjectId | no | MongoDB |
| `ownerId` | ObjectId | no | — |
| `itemId` | ObjectId | yes | null |
| `actorId` | ObjectId | no | — |
| `action` | enum `upload\|create_folder\|preview\|download\|rename\|move\|star\|unstar\|trash\|restore\|permanent_delete\|share` | no | — |
| `details` | bounded object | yes | null |
| `createdAt` | Date | no | now |

```js
db.item_activities.createIndex({ ownerId: 1, createdAt: -1, _id: -1 });
db.item_activities.createIndex({ itemId: 1, createdAt: -1, _id: -1 });
```

There are no content-edit or version-restore action values.

---

## 16. `audit_logs` — optional

**Purpose:** immutable security/compliance events.

| Field       | Type           | Nullable | Default |
| ----------- | -------------- | -------- | ------- |
| `_id`       | ObjectId       | no       | MongoDB |
| `actorId`   | ObjectId       | yes      | null    |
| `ownerId`   | ObjectId       | yes      | null    |
| `itemId`    | ObjectId       | yes      | null    |
| `action`    | String         | no       | —       |
| `snapshot`  | bounded object | yes      | null    |
| `ipAddress` | String         | yes      | null    |
| `createdAt` | Date           | no       | now     |

```js
db.audit_logs.createIndex({ itemId: 1, createdAt: -1, _id: -1 });
db.audit_logs.createIndex({ actorId: 1, createdAt: -1, _id: -1 });
db.audit_logs.createIndex({ action: 1, createdAt: -1, _id: -1 });
```

Audit documents are append-only. Retention/archive policy is configured explicitly; do not add TTL by accident.

---

## 17. `idempotency_keys`

**Purpose:** safely replay upload creation, upload completion, move, Trash, restore, and permanent-delete requests.

| Field            | Type           | Nullable | Default   |
| ---------------- | -------------- | -------- | --------- |
| `_id`            | ObjectId       | no       | MongoDB   |
| `userId`         | ObjectId       | no       | —         |
| `endpoint`       | String         | no       | —         |
| `key`            | String         | no       | —         |
| `requestHash`    | Binary(32)     | no       | —         |
| `responseStatus` | Int32          | no       | —         |
| `responseBody`   | bounded object | no       | —         |
| `createdAt`      | Date           | no       | now       |
| `expiresAt`      | Date           | no       | now + 24h |

```js
db.idempotency_keys.createIndex({ userId: 1, endpoint: 1, key: 1 }, { unique: true });
db.idempotency_keys.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

The same key with a different request hash returns `409 Conflict`.

---

## 18. `search_documents` — optional projection

**Purpose:** search projection built asynchronously from metadata events.

| Field            | Type                | Nullable | Default |
| ---------------- | ------------------- | -------- | ------- |
| `_id`            | ObjectId            | no       | item ID |
| `ownerId`        | ObjectId            | no       | —       |
| `name`           | String              | no       | —       |
| `normalizedName` | String              | no       | —       |
| `type`           | enum `file\|folder` | no       | —       |
| `mimeType`       | String              | yes      | null    |
| `extension`      | String              | yes      | null    |
| `isTrashed`      | Boolean             | no       | false   |
| `updatedAt`      | Date                | no       | now     |

This collection contains file metadata only. File-content indexing is out of scope unless a future product requirement explicitly adds it.

---

## 19. Recursive folder operations

The product actions are basic, but their cost can still be large when a folder contains many descendants.

### Initial implementation

- Execute rename and file move in one metadata write.
- Execute folder move/Trash/restore synchronously only below a measured `MAX_SYNC_SUBTREE_ITEMS`.
- Reject larger operations with a stable error until the worker phase exists.
- Use bounded batches for permanent deletion and storage cleanup.
- Never run an unbounded subtree loop inside one MongoDB transaction.

### Later worker phase

Add a job collection and temporary operation lock only when large real subtrees require asynchronous processing. At that point the minimum fields are:

```text
drive_items.activeOperationId: ObjectId | null

item_operations:
  _id: ObjectId
  ownerId: ObjectId
  rootItemId: ObjectId
  type: move_folder | trash_folder | restore_folder | permanent_delete
  status: queued | processing | completed | failed
  lastProcessedId: ObjectId | null
  processedCount: Int64
  leaseOwner: String | null
  leaseExpiresAt: Date | null
  attempts: Int32
  createdAt: Date
  updatedAt: Date
  completedAt: Date | null
```

This is an upgrade path, not a requirement for the MVP schema.

---

## 20. Optimistic concurrency

`metadataVersion` prevents stale metadata writes. It does not represent file content.

Example rename:

```js
db.drive_items.findOneAndUpdate(
  {
    _id: itemId,
    ownerId,
    metadataVersion: expectedMetadataVersion,
    isTrashed: false,
  },
  {
    $set: {
      name,
      normalizedName,
      lastModifiedAt: new Date(),
    },
    $inc: {
      metadataVersion: 1,
    },
  },
  {
    returnDocument: "after",
  }
);
```

A null result is resolved as not found, forbidden, or `DRIVE_ITEM_VERSION_CONFLICT`. Do not maintain both `metadataVersion` and Mongoose `__v` for the same concurrency contract. Choose one:

- Recommended API-explicit option: `metadataVersion`, with `versionKey: false`.
- Alternative: Mongoose `__v` with `optimisticConcurrency: true`.

---

## 21. TypeScript domain types

These types describe the domain model. Persistence schemas still enforce the actual MongoDB types.

```ts
import { Types } from "mongoose";

export enum DriveItemType {
  FILE = "file",
  FOLDER = "folder",
}

export enum FileStatus {
  UPLOADING = "uploading",
  PROCESSING = "processing",
  ACTIVE = "active",
  FAILED = "failed",
}

export interface DriveItemBase {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  parentId: Types.ObjectId | null;
  ancestorIds: Types.ObjectId[];
  name: string;
  normalizedName: string;
  isTrashed: boolean;
  trashedAt: Date | null;
  metadataVersion: number;
  createdAt: Date;
  updatedAt: Date;
  lastModifiedAt: Date;
}

export interface FileDriveItem extends DriveItemBase {
  type: DriveItemType.FILE;
  storageObjectId: Types.ObjectId | null;
  fileStatus: FileStatus;
  mimeType: string | null;
  sizeBytes: bigint | null;
  extension: string | null;
  childCount: null;
}

export interface FolderDriveItem extends DriveItemBase {
  type: DriveItemType.FOLDER;
  storageObjectId: null;
  fileStatus: null;
  mimeType: null;
  sizeBytes: null;
  extension: null;
  childCount: number;
}

export type DriveItem = FileDriveItem | FolderDriveItem;
```

API response types must not expose `normalizedName`, `_id`, `bucket`, `objectKey`, token hashes, password hashes, or checksums:

```ts
export interface DriveItemResponse {
  id: string;
  ownerId: string;
  parentId: string | null;
  name: string;
  type: DriveItemType;
  fileStatus: FileStatus | null;
  mimeType: string | null;
  sizeBytes: string | null;
  extension: string | null;
  childCount: number | null;
  isTrashed: boolean;
  metadataVersion: number;
  createdAt: string;
  updatedAt: string;
  lastModifiedAt: string;
}
```

### DTO validation

```ts
import { IsInt, IsMongoId, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class DriveItemIdParamDto {
  @IsMongoId()
  id!: string;
}

export class MoveDriveItemDto {
  @IsOptional()
  @IsMongoId()
  parentId?: string | null;

  @IsInt()
  @Min(1)
  expectedMetadataVersion!: number;
}

export class RenameDriveItemDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsInt()
  @Min(1)
  expectedMetadataVersion!: number;
}
```

`normalizedName`, `ancestorIds`, `ownerId`, `storageObjectId`, `fileStatus`, `mimeType`, and verified `sizeBytes` are server-controlled fields. Clients must not be allowed to set them directly.

---

## 22. NestJS module boundary

```text
Controller
   -> Service
      -> Repository
         -> Mongoose Model
            -> MongoDB
```

```text
src/modules/
├── auth/
├── users/
├── drive-items/
│   ├── dto/
│   ├── schemas/
│   ├── repositories/
│   ├── drive-items.controller.ts
│   ├── drive-items.service.ts
│   └── drive-items.module.ts
├── uploads/
├── storage/
├── previews/
├── trash/
├── sharing/
└── quota/
```

- Controllers validate and translate HTTP input.
- Services enforce authorization, hierarchy, state transitions, and business rules.
- Repositories own Mongoose queries, projections, cursor filters, and atomic updates.
- Schemas own storage shape, indexes, defaults, and schema-level validation.
- One concrete repository per aggregate is sufficient. Do not add abstract repositories or injection tokens without a real alternative implementation.
- Read-only list/detail queries should use projections and `lean()`.

There is no `file-versions` module.

---

## 23. Upload, preview, move, and delete flows

### Upload

```text
Reserve name and quota
  -> create file placeholder
  -> create upload session
  -> upload immutable object
  -> verify checksum/MIME/scan
  -> create storage object
  -> activate file metadata
  -> commit quota
```

### Preview/download

```text
Authorize drive item
  -> require fileStatus=active
  -> load storage object
  -> require safe scan state
  -> return signed URL or stream
```

### Rename/move

```text
Validate expected metadata version
  -> authorize source and destination
  -> verify destination is a folder
  -> prevent cycle
  -> update metadata only
  -> increment metadataVersion
```

The physical object key never changes.

### Trash/permanent delete

```text
Trash:
  mark metadata as trashed
  keep storage object
  allow restore

Permanent delete:
  authorize and mark storage object deleting
  delete physical object idempotently
  delete metadata
  decrement used quota
```

If physical deletion fails, retain a recoverable `delete_failed` storage state for worker retry. Do not report successful permanent deletion while silently leaking storage indefinitely.

---

## 24. Performance and scale policy

### Strong paths

- Item lookup by `_id`.
- Folder list by equality-prefix compound index and cursor.
- Rename/file move/Trash as single-item metadata writes.
- Breadcrumb from bounded `ancestorIds`.
- Preview/download through two point lookups.
- Name uniqueness enforced by MongoDB while unsharded.

### Measured risks

| Risk | Cause | Mitigation |
| --- | --- | --- |
| Huge folder move | Descendant `ancestorIds` must change. | Sync threshold, then asynchronous bounded batches. |
| Huge folder Trash/restore | Materialized subtree state requires many writes. | Sync threshold, then worker phase. |
| Hot parent | Many child mutations share the same index prefix and `childCount`. | Treat `childCount` as approximate; coalesce updates. |
| Upload leaks | Object storage is outside MongoDB transactions. | Idempotent reaper and reconciliation. |
| Index bloat | Every index increases RAM and write cost. | Create only indexes used by enabled API sorts/filters. |
| Large page numbers | `skip` cost grows with offset. | Cursor pagination only. |
| Premature sharding | Unique-name constraints and multi-collection writes become harder. | Start with a replica set and shard only after measurements. |

### Required benchmarks

| Test | Dataset | Verify |
| --- | --- | --- |
| Folder list | Normal folders and a 100k-child folder | P50/P95/P99, no blocking sort, stable cursor. |
| Deep breadcrumb | Depth 16, 32, and 64 | Bounded reads and response time. |
| Same-name race | 100 concurrent creates/uploads | Exactly one winner; no quota/object leak. |
| Metadata race | Concurrent rename and move | One succeeds per expected version; conflict is explicit. |
| Upload retry | Retry every transition | One active file and one committed quota result. |
| Worker/reaper crash | Crash after each cleanup step | No permanent object/quota/session inconsistency. |
| Large folder move | Up to configured sync limit | Predictable timeout and memory usage. |
| Storage outage | Timeout and partial failures | Bounded retry; no exhausted request threads. |

Retain `explain("executionStats")` evidence for hot queries and monitor:

- `COLLSCAN`;
- `docsExamined / nReturned`;
- blocking sorts;
- index working-set size;
- replication lag;
- duplicate-key rate;
- stale upload sessions;
- orphan storage objects;
- quota drift.

The schema supports growth, but it cannot guarantee one million concurrent users without representative load tests, hardware sizing, object-storage throughput, and explicit SLOs.

---

## 25. Removed or renamed fields

| Previous design | New design | Reason |
| --- | --- | --- |
| `id: UUIDv7` plus MongoDB `_id` | `_id: ObjectId` only | Avoid duplicate identifiers, indexes, storage, and inconsistent references. |
| `version` | `metadataVersion` | Make clear that it protects metadata, not file content. |
| `status` on every item | `fileStatus` on files; null on folders | Folder availability does not use upload lifecycle. |
| `isDeleted` | `isTrashed` | The field represents recoverable Trash state, not permanent deletion. |
| `deletedAt` | `trashedAt` | Match Trash semantics. |
| `currentVersionId` | removed | Content-version history is out of scope. |
| `nextVersionNumber` | removed | No content-version allocation exists. |
| `file_versions` | removed | One immutable storage object per file. |
| `file_blobs` with dedup/refCount | `storage_objects` one-to-one baseline | Avoid deduplication and GC complexity before it is required. |
| `operationState` | removed from baseline | Not needed for ordinary single-item metadata actions. |
| `operationId` | removed from baseline | Added only with a future asynchronous operation system. |
| `processing_jobs` | future `item_operations` upgrade | Do not make worker infrastructure mandatory for MVP. |
| Version-restore activities | removed | No content versions exist. |

---

## 26. Recommended implementation order

1. `users`, sessions, and token rotation.
2. `drive_items` with folder creation, list, detail, breadcrumb, and rename.
3. File/folder move with cycle validation and optimistic concurrency.
4. `storage_objects` and `upload_sessions`.
5. Read-only preview/download with authorization and Range support.
6. Trash, restore, permanent deletion, and quota reconciliation.
7. Star state.
8. Idempotency and recovery/reaper tests.
9. Sharing and public links if required.
10. Search/activity projections if required.
11. Benchmark real subtree sizes before adding asynchronous item operations.
12. Review sharding only after replica-set limits are measured.

---

\
