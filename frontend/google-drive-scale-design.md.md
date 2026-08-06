# File Central — Database Schema

Companion to `google-drive-scale-design.md` and `google-drive-api-contract.md`. MongoDB collections. Conventions:

- **External `id`** = UUIDv7, stored as `BinData(4)`, exposed as hex string. Internal `_id` may be ObjectId; only `id` is ever serialized.
- All timestamps are UTC, ISO-8601 on the wire, `Date` in storage.
- "Nullable" = field may be `null`/absent. "Default" = value on insert when omitted.
- Shard keys listed apply **only when a collection is sharded** (§8 of design); until then, a replica set carries load.
- Indexes marked **primary-read** must be read from the primary (permission/quota).

---

## 0. Scale assessment and deployment policy

### 0.1. Overall assessment

This schema is **strong for a large Drive-style system on a replica set**, because the main user-facing reads are bounded and indexable:

- children list: equality on `(ownerId, parentId, isDeleted)` + cursor sort;
- item lookup: `id`;
- subtree/inheritance: `ancestorIds` multikey;
- versions: `(itemId, versionNumber)`;
- uploads: explicit sessions and parts;
- storage: metadata separated from binary;
- derived views (`search_documents`, `shared_with_me`, activities): outbox-built, so they do not block the core write path.

The schema alone **cannot prove a fixed user count or requests/second**. Capacity depends on folder-size distribution, average versions per file, upload concurrency, working-set fit, storage latency, indexes, hardware, and SLOs. Treat scale as a measured progression rather than a promise based only on document shape.

### 0.2. Primary scale risks

| Risk | Why it matters | Required mitigation |
| --- | --- | --- |
| Large folder move/delete/restore | `ancestorIds` and trash state require `O(subtree size)` writes | background job, operation lock, bounded batches, checkpoint/retry |
| Hot parent folder | `childCount` and frequent child mutations target one parent document/index range | coalesce count deltas; never update parent per click; large-folder tests |
| Global blob dedup | one popular hash can create a hot `refCount` document and cross-tenant coupling | owner/workspace-scoped dedup by default |
| Concurrent upload completion | name uniqueness is enforced only when an item becomes active | atomic finalize + cleanup; optional name reservation when wasted uploads become material |
| Independent sharding of core collections | upload/finalize/delete can become multi-shard transactions | keep the strongly consistent core unsharded until measured need; shard projections/logs first |
| UUIDv7 ranged shard keys | UUIDv7 is time-ordered; ranged inserts can concentrate on the newest range | do not approve a shard key from schema alone; validate with production-like cardinality and routing tests |
| TTL as workflow trigger | TTL deletion is asynchronous | explicit reaper queries by `expiresAt`; TTL is only a safety net |

### 0.3. Deployment phases

**Phase A — recommended initial production**

- MongoDB 3-data-bearing-node replica set.
- MinIO/S3-compatible object storage separated from MongoDB.
- Cursor pagination only for Drive, Trash, versions, activities, and shared lists.
- `drive_items`, `file_versions`, `file_blobs`, permissions, quota, upload sessions, and outbox remain unsharded.
- Background workers handle recursive and storage-reconciliation work.

**Phase B — scale reads and append-heavy workloads first**

Possible first sharding/offloading candidates:

- `audit_logs`, `security_audit_events`, `item_activities`;
- `search_documents` or a dedicated search engine;
- `user_item_activities`, if Redis buffering and batch writes are no longer enough;
- cold/archive data.

**Phase C — shard the core only after evidence**

Before sharding file/folder metadata, capture:

- item count and bytes per owner/workspace;
- P95/P99 children-list latency;
- largest folder child count;
- largest subtree size and recursive-job duration;
- writes/second to one parent folder;
- concurrent uploads per user/workspace;
- frequency of cross-collection transactions;
- shard targeting percentage and scatter-gather rate.

### 0.4. Important sharding correction

The shard keys in this document are **candidates, not deployable guarantees**. MongoDB unique indexes on a sharded collection generally require the shard key as an index prefix. Several current combinations do not satisfy that rule, including:

- `drive_items`: shard `{ownerId, _id}` versus unique `{ownerId, parentId, normalizedName}` and unique `{id}`;
- `refresh_tokens`: shard by `userId` versus unique `tokenHash`;
- `file_versions`: shard by hashed `itemId` versus unique `{itemId, versionNumber}`;
- `upload_parts`: shard by hashed `uploadSessionId` versus unique `{uploadSessionId, partNumber}`;
- `drive_permissions`: shard by hashed `itemId` versus partial unique `{itemId, granteeUserId}`;
- `share_links`: shard by `itemId` versus unique `tokenHash`;
- user-state and idempotency collections with unique keys that do not include the full shard-key pattern.

Therefore:

1. keep these collections unsharded while the unique constraints are database-enforced;
2. do not enable sharding from the comments in this schema without a separate sharding design review;
3. if core sharding becomes mandatory, introduce a dedicated uniqueness/reservation strategy or accept application-enforced uniqueness with reconciliation;
4. avoid turning every upload completion into a distributed transaction across independently sharded collections.

---

## 1. `users`

**Purpose:** identity, status, credentials (hashed).

| Field              | Type                            | Nullable | Default  | Notes             |
| ------------------ | ------------------------------- | -------- | -------- | ----------------- |
| `id`               | UUIDv7                          | no       | gen      | PK (external).    |
| `email`            | string                          | no       | —        | Lowercased.       |
| `username`         | string                          | no       | —        |                   |
| `name`             | string                          | no       | —        | Display.          |
| `passwordHash`     | string                          | no       | —        | argon2id.         |
| `avatarUrl`        | string                          | yes      | null     |                   |
| `status`           | enum `active\|locked\|disabled` | no       | `active` |                   |
| `failedLoginCount` | int                             | no       | 0        | Reset on success. |
| `lockedUntil`      | Date                            | yes      | null     | Brute-force lock. |
| `createdAt`        | Date                            | no       | now      |                   |
| `updatedAt`        | Date                            | no       | now      |                   |

**Constraints:** unique `email`, unique `username`. Check: `status ∈ enum`. **Indexes:** `{email:1}` unique · `{username:1}` unique. **Access patterns:** login by username/email; profile by id.

```json
{
  "id": "019481c2-1a2b-73ef-9c00-0001",
  "email": "a@ex.com",
  "username": "alice",
  "name": "Alice",
  "status": "active",
  "failedLoginCount": 0,
  "createdAt": "2026-07-01T00:00:00Z"
}
```

---

## 2. `user_sessions`

**Purpose:** active login sessions (device/IP/lastSeen) for listing & revocation.

| Field        | Type   | Nullable | Default |
| ------------ | ------ | -------- | ------- |
| `id`         | UUIDv7 | no       | gen     |
| `userId`     | UUIDv7 | no       | —       |
| `device`     | string | yes      | null    |
| `ip`         | string | yes      | null    |
| `createdAt`  | Date   | no       | now     |
| `lastSeenAt` | Date   | no       | now     |
| `revokedAt`  | Date   | yes      | null    |

**Indexes:** `{userId:1, revokedAt:1, lastSeenAt:-1}`. **Shard:** `{userId:"hashed"}`. **Access:** list active sessions; revoke by id.

---

## 3. `refresh_tokens`

**Purpose:** rotating refresh tokens, **hashed**, family-tracked for reuse detection.

| Field       | Type   | Nullable | Default | Notes                                  |
| ----------- | ------ | -------- | ------- | -------------------------------------- |
| `id`        | UUIDv7 | no       | gen     |                                        |
| `userId`    | UUIDv7 | no       | —       |                                        |
| `familyId`  | UUIDv7 | no       | —       | Rotation lineage.                      |
| `tokenHash` | string | no       | —       | SHA-256 of token. **Never store raw.** |
| `usedAt`    | Date   | yes      | null    | Set on rotation.                       |
| `revokedAt` | Date   | yes      | null    | Family revoke on reuse.                |
| `expiresAt` | Date   | no       | —       | TTL-backed.                            |
| `createdAt` | Date   | no       | now     |                                        |

**Constraints:** unique `{tokenHash}`. Reuse rule: presenting a token whose `usedAt != null` → revoke all rows with same `familyId`. **Indexes:** `{tokenHash:1}` unique · `{familyId:1}` · `{expiresAt:1}` TTL `expireAfterSeconds:0`. **Sharding:** keep unsharded while `tokenHash` uniqueness is database-enforced; `{userId:"hashed"}` is only a redesign candidate.

---

## 4. `security_audit_events`

**Purpose:** append-only auth/security events (login success/fail, lock, password reset, token reuse).

| Field       | Type   | Nullable | Default |
| ----------- | ------ | -------- | ------- |
| `id`        | UUIDv7 | no       | gen     |
| `userId`    | UUIDv7 | yes      | null    |
| `event`     | string | no       | —       |
| `ip`        | string | yes      | null    |
| `metadata`  | object | yes      | {}      |
| `createdAt` | Date   | no       | now     |

**Immutable.** No TTL (archived to cold storage). **Indexes:** `{userId:1, createdAt:-1}` · `{event:1, createdAt:-1}`.

---

## 5. `drive_items`

**Purpose:** logical file/folder metadata + hierarchy. **Carries no storage key.** This is the hottest core collection for Drive navigation.

| Field | Type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | UUIDv7 | no | gen | External ID. Unique while unsharded. |
| `name` | string | no | — | Display, verbatim after allowed trim policy. |
| `normalizedName` | string | no | — | Versioned normalization algorithm; not serialized. |
| `type` | enum `file\|folder` | no | — | Discriminator. |
| `ownerId` | UUIDv7 | no | — | Logical owner/scope. All hierarchy queries include it. |
| `parentId` | UUIDv7 | yes | null | null = root. Application-managed reference. |
| `ancestorIds` | UUIDv7[] | no | [] | Root→direct-parent. Bounded by `MAX_FOLDER_DEPTH`. |
| `status` | enum `uploading\|processing\|active\|failed` | no | `active` folder / `uploading` file | File availability lifecycle, not recursive-operation state. |
| `operationState` | enum `idle\|moving\|deleting\|restoring` | no | `idle` | Locks conflicting hierarchy operations. |
| `operationId` | UUIDv7 | yes | null | FK-like reference → `processing_jobs`. |
| `isDeleted` | bool | no | false | Materialized Trash state. |
| `deletedAt` | Date | yes | null | Must agree with `isDeleted`. |
| `version` | int | no | 1 | Optimistic concurrency for metadata. |
| `nextVersionNumber` | int | yes (files) | 1 | Atomically incremented to allocate immutable file-version numbers. |
| `childCount` | int | yes (folders) | 0 | Approximate/eventually consistent count of direct active, non-deleted children. |
| `currentVersionId` | UUIDv7 | yes (files) | null | Reference → active `file_versions` row. |
| `mimeType` | string | yes (files) | null | Denormalized current-version MIME. |
| `size` | long | yes (files) | null | Denormalized current-version size. |
| `extension` | string | yes (files) | null | Denormalized display/filter field. |
| `createdAt` | Date | no | now |  |
| `updatedAt` | Date | no | now | Any physical document update. |
| `lastModifiedAt` | Date | no | now | User-visible item change only; do not bump for child-count reconciliation. |

### Constraints

- Unique active name while unsharded: `{ownerId, parentId, normalizedName}` partial `{status:"active", isDeleted:false}`.
- Folder:
  - `status="active"` after creation;
  - `currentVersionId=null`;
  - `nextVersionNumber=null`;
  - `mimeType/size/extension=null`;
  - `childCount>=0`.
- File:
  - `childCount=null`;
  - `status="active"` requires `currentVersionId`, `mimeType`, and `size`;
  - `status="uploading"|"processing"` may have `currentVersionId=null`.
- `isDeleted=false` requires `deletedAt=null`; `isDeleted=true` requires `deletedAt`.
- `operationState="idle"` requires `operationId=null`; non-idle state requires `operationId`.
- `ancestorIds` must not contain self, must end with `parentId`, and must not exceed `MAX_FOLDER_DEPTH` (recommended initial limit: 256).
- All parent/ancestor references must belong to the same `ownerId`/scope.

### Indexes — replica-set baseline

```js
// Default Drive list: active children, recently modified, cursor=(lastModifiedAt,_id).
db.drive_items.createIndex(
  { ownerId: 1, parentId: 1, isDeleted: 1, lastModifiedAt: -1, _id: -1 },
  { partialFilterExpression: { status: "active", operationState: "idle" } }
);

// Optional name view: folders first (type desc), then normalized name and stable tie-breaker.
db.drive_items.createIndex(
  { ownerId: 1, parentId: 1, isDeleted: 1, type: -1, normalizedName: 1, _id: 1 },
  { partialFilterExpression: { status: "active", operationState: "idle" } }
);

// Enforce one active name per parent while the collection is unsharded.
db.drive_items.createIndex(
  { ownerId: 1, parentId: 1, normalizedName: 1 },
  { unique: true, partialFilterExpression: { status: "active", isDeleted: false } }
);

// Subtree + permission inheritance. Always include owner/scope in the query.
db.drive_items.createIndex({ ownerId: 1, ancestorIds: 1, isDeleted: 1 });

// Trash cursor.
db.drive_items.createIndex({ ownerId: 1, isDeleted: 1, deletedAt: -1, _id: -1 });

// Upload placeholders/recovery.
db.drive_items.createIndex({ ownerId: 1, status: 1, createdAt: 1 });

// External lookup while unsharded.
db.drive_items.createIndex({ id: 1 }, { unique: true });
```

Do not create every optional sort index automatically. Enable only the sort modes exposed by the API, confirm with `explain("executionStats")`, and monitor index memory/write cost.

### Hot access patterns and expected complexity

| Operation | Query/write shape | Scale behavior |
| --- | --- | --- |
| List one folder | equality prefix + cursor + limit | bounded by page size; no large `skip` |
| Get item | unique `id` | point lookup |
| Breadcrumb | read item `ancestorIds`, batch fetch ancestor names | `O(depth)`; depth bounded |
| Permission inheritance | IDs = self + ancestors | `O(depth)` IDs, one indexed permission query |
| Subtree scan | `{ownerId, ancestorIds:folderId}` | `O(subtree size)` result scan |
| Rename | one document + unique index | constant-size write |
| Move file | one document | constant-size write |
| Move/delete/restore folder | root + all descendants | `O(subtree size)` writes; async above threshold |

### Large-folder and recursive-operation rules

- Never paginate Drive with large `skip`; use `(sortValue, _id)` cursor.
- List responses must project only UI fields; omit `ancestorIds` unless required.
- `childCount` is never an authority for “folder is empty”. The worker should coalesce many deltas for the same folder before flushing.
- Do not bubble `lastModifiedAt` to every ancestor when a child changes; this creates hot ancestor documents.
- Small subtree operations may run synchronously under a measured threshold.
- Large move/delete/restore/copy must:
  1. CAS root from `operationState=idle` to the operation state;
  2. create a `processing_jobs` record;
  3. hide or lock the affected subtree from conflicting writes;
  4. process deterministic `_id` batches with checkpoints;
  5. be idempotent on retry;
  6. clear `operationState/operationId` only after verification.
- Avoid one giant transaction for a large subtree.

### Upload name concurrency

The partial unique index permits duplicate `uploading` placeholders and resolves the conflict at activation. Finalization must be atomic:

1. verify object/checksum/MIME/scan policy;
2. allocate version number;
3. create or attach blob/version;
4. transition exactly one same-name item to `active`;
5. on `E11000`, mark the losing upload failed, release quota, and remove its unreferenced object/version.

If duplicate concurrent uploads waste meaningful bandwidth, add a short-lived `drive_name_reservations` resource instead of weakening correctness.

### Sharding decision

**Do not shard `drive_items` using `{ownerId:1,_id:1}` while relying on the current unique active-name index.** The shard key is not a prefix of that unique index. Keep this collection on the replica set until a separate uniqueness and routing design is approved.

```json
{
  "id": "019481folder1",
  "name": "Reports",
  "normalizedName": "reports",
  "type": "folder",
  "ownerId": "019481c2-...-0001",
  "parentId": null,
  "ancestorIds": [],
  "status": "active",
  "operationState": "idle",
  "isDeleted": false,
  "version": 1,
  "childCount": 2,
  "createdAt": "2026-07-10T00:00:00Z",
  "lastModifiedAt": "2026-07-28T09:00:00Z"
}
```

---

## 6. `file_blobs`

**Purpose:** physical, content-addressed object metadata. Never serialized to clients.

Global cross-user dedup is **not the default recommendation**. It couples tenants, can leak timing information, conflicts with per-tenant encryption policies, and can turn one common content hash into a hot `refCount` document. Prefer dedup scoped to an owner or workspace.

| Field | Type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | UUIDv7 | no | gen | External ID. |
| `dedupScopeId` | UUIDv7 | no | — | Owner/workspace scope for dedup isolation. |
| `contentHash` | string | no | — | Server-verified SHA-256. |
| `dedupKey` | string | yes | generated | Deterministic `scope + hash`; null only after GC claims deletion. |
| `storageProvider` | string | no | `minio` | `minio\|s3`. |
| `bucket` | string | no | — | Internal. |
| `objectKey` | string | no | — | Opaque and immutable. |
| `size` | long | no | — |  |
| `refCount` | int | no | 0 | Exact in baseline; reconcile periodically. |
| `scanState` | enum `pending\|clean\|infected\|error` | no | `pending` | `clean` gates normal download. |
| `state` | enum `active\|pending_deletion\|deleting\|deleted` | no | `active` | Idempotent GC state machine. |
| `pendingDeletionAt` | Date | yes | null | Grace-window start. |
| `encryption` | object | yes | null | `{ algorithm, keyId }`. |
| `createdAt` | Date | no | now |  |
| `updatedAt` | Date | no | now | CAS/reconciliation support. |

### Constraints and indexes

```js
// One reusable blob per dedup scope and hash. `dedupKey` is released when GC claims deletion.
db.file_blobs.createIndex(
  { dedupKey: 1 },
  { unique: true, partialFilterExpression: { dedupKey: { $type: "string" } } }
);

db.file_blobs.createIndex({ dedupScopeId: 1, contentHash: 1 });
db.file_blobs.createIndex({ state: 1, pendingDeletionAt: 1, _id: 1 });
db.file_blobs.createIndex({ scanState: 1, createdAt: 1 });
db.file_blobs.createIndex({ id: 1 }, { unique: true });
```

Rules:

- `refCount >= 0`.
- `state="active"` requires `refCount>0` in normal steady state.
- `state="pending_deletion"` requires `refCount=0`, non-null `pendingDeletionAt`, and retained `dedupKey` so a grace-period upload can safely revive the blob.
- `state="deleting"|"deleted"` requires `dedupKey=null`; this releases the unique slot for a newly uploaded object with the same content.
- A blob with `scanState!="clean"` is not available for normal download.

### Correct dedup/GC state machine

**Attach/revive:**

1. lookup by `dedupKey`;
2. CAS `active|pending_deletion → active` and increment `refCount`;
3. if no reusable row exists, create a new object and blob document;
4. duplicate-key means another request won; reload and attach.

**Release:**

1. CAS decrement `refCount`;
2. when it reaches zero, set `state="pending_deletion"` and `pendingDeletionAt=now`;
3. retain the object during a grace window.

**GC:**

1. select expired `pending_deletion` rows;
2. CAS `{state:"pending_deletion",refCount:0}` to `{state:"deleting",dedupKey:null}`;
3. delete the object from storage idempotently;
4. set `state="deleted"`;
5. if the worker crashes, retry rows in `deleting` until storage confirms absence.

Do **not** mark a blob `deleted` before the object-store deletion succeeds. Object storage is outside the MongoDB transaction.

### Hot-ref mitigation

For normal owner/workspace-scoped dedup, exact `refCount` is acceptable. If a single scope can create extreme references to the same blob:

- buffer increments/decrements and reconcile;
- or introduce immutable `blob_references` and derive count;
- alert on refcount drift;
- never allow negative count;
- benchmark concurrent attach/release on one hash.

### Sharding decision

Keep `file_blobs` unsharded initially. A hashed shard key plus an independent unique dedup constraint requires a separate design; do not assume `{contentHash:"hashed"}` preserves the current global/scoped uniqueness contract.

```json
{
  "id": "019481blob1",
  "dedupScopeId": "019481c2-...-0001",
  "contentHash": "e3b0c442...",
  "dedupKey": "scope:hash",
  "storageProvider": "minio",
  "bucket": "fc-blobs",
  "objectKey": "blobs/e3/019481aa-...",
  "size": 5242880,
  "refCount": 2,
  "scanState": "clean",
  "state": "active",
  "encryption": { "algorithm": "AES256", "keyId": "sse-1" },
  "createdAt": "2026-07-20T10:00:00Z"
}
```

---

## 7. `file_versions`

**Purpose:** immutable pointer from a logical file item to a physical blob version.

| Field           | Type   | Nullable | Default | Notes                                                           |
| --------------- | ------ | -------- | ------- | --------------------------------------------------------------- |
| `id`            | UUIDv7 | no       | gen     | External ID.                                                    |
| `itemId`        | UUIDv7 | no       | —       | Reference → `drive_items`.                                      |
| `ownerId`       | UUIDv7 | no       | —       | Denormalized scope for audit/reconciliation and future routing. |
| `blobId`        | UUIDv7 | no       | —       | Reference → `file_blobs`.                                       |
| `versionNumber` | int    | no       | —       | Allocated atomically from `drive_items.nextVersionNumber`.      |
| `size`          | long   | no       | —       | Immutable.                                                      |
| `mimeType`      | string | no       | —       | Signature-detected.                                             |
| `checksum`      | string | no       | —       | Server-verified; normally equals the blob content hash.         |
| `createdById`   | UUIDv7 | no       | —       | Reference → users.                                              |
| `createdAt`     | Date   | no       | now     |                                                                 |

**Constraints:** unique `{itemId, versionNumber}` while unsharded; immutable after insert.

**Indexes:**

```js
db.file_versions.createIndex({ itemId: 1, versionNumber: -1 }, { unique: true });
db.file_versions.createIndex({ blobId: 1, _id: 1 });
db.file_versions.createIndex({ ownerId: 1, createdAt: -1, _id: -1 });
db.file_versions.createIndex({ id: 1 }, { unique: true });
```

### Version allocation and finalize

Never derive the next version with `count()+1` or `find latest + 1` under concurrency.

1. CAS/increment `drive_items.nextVersionNumber` to reserve a number.
2. Insert immutable `file_versions`.
3. Update the file item’s `currentVersionId`, `size`, `mimeType`, `extension`, `status`, `version`, and `lastModifiedAt`.
4. Commit quota and write outbox intent in a short database transaction on the replica set.
5. Storage upload and virus scanning remain outside that transaction and are handled by an idempotent state machine.

A version row may temporarily exist without being current. Reconciliation must detect versions not linked to an item or retained history policy.

### Sharding decision

Keep unsharded with the core metadata initially. `{itemId:"hashed"}` is not automatically compatible with the current unique `{itemId,versionNumber}` contract, and independent sharding increases the chance that one finalize operation spans multiple shards.

```json
{
  "id": "019481ver2",
  "itemId": "019481file1",
  "ownerId": "019481c2-...-0001",
  "blobId": "019481blob1",
  "versionNumber": 2,
  "size": 5242880,
  "mimeType": "application/pdf",
  "checksum": "e3b0c442...",
  "createdById": "019481c2-...-0001",
  "createdAt": "2026-07-28T09:00:00Z"
}
```

---

## 8. `upload_sessions`

**Purpose:** explicit single/multipart upload lifecycle with quota and recovery. TTL is a cleanup safety net, not the workflow scheduler.

| Field | Type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | UUIDv7 | no | gen |  |
| `userId` | UUIDv7 | no | — |  |
| `itemId` | UUIDv7 | no | — | Placeholder file item (`status=uploading`). |
| `parentId` | UUIDv7 | yes | null | Snapshot of target location. |
| `method` | enum `put\|multipart` | no | — |  |
| `providerUploadId` | string | yes | null | Object-provider multipart ID. |
| `blobObjectKey` | string | no | — | Reserved opaque temporary/final key. |
| `declaredSize` | long | no | — | Reserved quota bytes. |
| `actualSize` | long | yes | null | Set after verification. |
| `declaredChecksum` | string | yes | null | Never trusted until verified. |
| `verifiedChecksum` | string | yes | null | Server-calculated. |
| `status` | enum `pending\|uploaded\|processing\|completed\|aborted\|expired\|failed` | no | `pending` |  |
| `idempotencyKey` | string | yes | null | Prevent duplicate session creation. |
| `createdAt` | Date | no | now |  |
| `updatedAt` | Date | no | now |  |
| `expiresAt` | Date | no | now+TTL | Checked by application and indexed by TTL. |

**Indexes:**

```js
db.upload_sessions.createIndex({ userId: 1, status: 1, createdAt: -1, _id: -1 });
db.upload_sessions.createIndex({ status: 1, expiresAt: 1, _id: 1 }); // explicit reaper
db.upload_sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // safety net
db.upload_sessions.createIndex(
  { userId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);
db.upload_sessions.createIndex({ id: 1 }, { unique: true });
```

### Upload state machine

```text
pending
  → uploaded       object transfer completed
  → processing     checksum/MIME/scan/dedup/finalize
  → completed      item active, version linked, quota committed

pending|uploaded|processing
  → aborted|expired|failed
```

### Reaper

A worker explicitly scans:

```js
{ status:{ $in:["pending","uploaded","processing"] }, expiresAt:{ $lte:now } }
```

and then idempotently:

1. aborts provider multipart upload if present;
2. removes unreferenced temporary object;
3. releases quota reservation exactly once;
4. marks the placeholder item failed or removes it according to retention policy;
5. marks the session expired/failed.

The API must reject expired sessions even if MongoDB has not physically TTL-deleted the row yet.

### Performance rules

- Prefer direct-to-object-storage signed upload for large files so application servers do not proxy all bytes.
- Bound multipart part count and session lifetime.
- Batch-register parts or accept provider completion manifests when safe; one DB write per tiny chunk will become expensive.
- Keep finalize idempotent: retries must return the same completed file/version.
- Keep unsharded initially to avoid cross-shard finalize transactions.

---

## 9. `upload_parts`

**Purpose:** multipart part registry for resume/complete. Use only when the provider manifest is insufficient for the product’s recovery/audit needs.

| Field             | Type   | Nullable | Default |
| ----------------- | ------ | -------- | ------- |
| `id`              | UUIDv7 | no       | gen     |
| `uploadSessionId` | UUIDv7 | no       | —       |
| `partNumber`      | int    | no       | —       |
| `etag`            | string | no       | —       |
| `size`            | long   | yes      | null    |
| `createdAt`       | Date   | no       | now     |

**Constraints:** unique `{uploadSessionId, partNumber}` while unsharded; validate provider part-number range.

**Indexes:**

```js
db.upload_parts.createIndex({ uploadSessionId: 1, partNumber: 1 }, { unique: true });
db.upload_parts.createIndex({ id: 1 }, { unique: true });
```

**Performance:** upsert registration is idempotent. Avoid using extremely small parts, and do not list all parts without a bound. For high part counts, use cursor/batch retrieval or provider-side completion metadata.

**Sharding:** keep unsharded with upload sessions initially. `{uploadSessionId:"hashed"}` is not automatically compatible with the unique compound key.

---

## 10. `drive_permissions`

**Purpose:** explicit user ACEs. Inheritance via `ancestorIds` — **no per-descendant rows.**

| Field           | Type                  | Nullable | Default | Notes                    |
| --------------- | --------------------- | -------- | ------- | ------------------------ |
| `id`            | UUIDv7                | no       | gen     |                          |
| `itemId`        | UUIDv7                | no       | —       | FK → drive_items.        |
| `granteeUserId` | UUIDv7                | no       | —       | FK → users.              |
| `role`          | enum `viewer\|editor` | no       | —       |                          |
| `canDownload`   | bool                  | no       | true    | Viewer may be view-only. |
| `createdById`   | UUIDv7                | no       | —       |                          |
| `revokedAt`     | Date                  | yes      | null    |                          |
| `version`       | int                   | no       | 1       | Optimistic concurrency.  |
| `createdAt`     | Date                  | no       | now     |                          |
| `updatedAt`     | Date                  | no       | now     |                          |

**Constraints:** **unique** `{itemId, granteeUserId}` **partial** `{revokedAt:null}` (one live ACE per grantee per item). **Indexes (primary-read):**

```js
db.drive_permissions.createIndex(
  { itemId: 1, granteeUserId: 1 },
  { unique: true, partialFilterExpression: { revokedAt: null } }
); // single-item + batched child resolution
db.drive_permissions.createIndex({ granteeUserId: 1, revokedAt: 1, updatedAt: -1, _id: -1 });
db.drive_permissions.createIndex({ itemId: 1, revokedAt: 1 });
```

**Sharding:** keep unsharded while the partial unique ACE constraint is database-enforced; `{itemId:"hashed"}` is only a redesign candidate. **Resolution:** single item → `{itemId:{$in:[self,...ancestors]}, granteeUserId, revokedAt:null}`; listing → subtree-root role once + one batched `{itemId:{$in:childIds}}` (2 queries, N-independent).

```json
{
  "id": "019481perm1",
  "itemId": "019481folder1",
  "granteeUserId": "019481c2-...-0002",
  "role": "editor",
  "canDownload": true,
  "createdById": "019481c2-...-0001",
  "revokedAt": null,
  "version": 1,
  "createdAt": "2026-07-25T12:00:00Z"
}
```

---

## 11. `share_links`

**Purpose:** public link tokens (**hashed**), expiry, password.

| Field          | Type          | Nullable | Default  | Notes                                               |
| -------------- | ------------- | -------- | -------- | --------------------------------------------------- |
| `id`           | UUIDv7        | no       | gen      |                                                     |
| `itemId`       | UUIDv7        | no       | —        |                                                     |
| `tokenHash`    | string        | no       | —        | **SHA-256(token). Raw token never stored.**         |
| `role`         | enum `viewer` | no       | `viewer` |                                                     |
| `canDownload`  | bool          | no       | true     |                                                     |
| `passwordHash` | string        | yes      | null     | argon2id; `passwordProtected = passwordHash!=null`. |
| `expiresAt`    | Date          | yes      | null     | TTL when set.                                       |
| `revokedAt`    | Date          | yes      | null     |                                                     |
| `createdById`  | UUIDv7        | no       | —        |                                                     |
| `createdAt`    | Date          | no       | now      |                                                     |

**Indexes:** `{tokenHash:1}` unique · `{itemId:1, revokedAt:1}` · `{expiresAt:1}` TTL `expireAfterSeconds:0`. **Sharding:** keep unsharded while global `tokenHash` uniqueness is required; `{itemId:"hashed"}` is not compatible with that unique index as written. **Resolution:** lookup by `SHA-256(clientToken)`; check `revokedAt`/`expiresAt`; verify `passwordHash`. Not-found/revoked/expired all return `LINK_NOT_FOUND` (no oracle).

---

## 12. `share_invitations`

**Purpose:** email invites for not-yet-users; materialize an ACE on accept.

| Field          | Type                                       | Nullable | Default   |
| -------------- | ------------------------------------------ | -------- | --------- |
| `id`           | UUIDv7                                     | no       | gen       |
| `itemId`       | UUIDv7                                     | no       | —         |
| `inviteeEmail` | string                                     | no       | —         |
| `role`         | enum `viewer\|editor`                      | no       | —         |
| `status`       | enum `pending\|accepted\|revoked\|expired` | no       | `pending` |
| `invitedById`  | UUIDv7                                     | no       | —         |
| `expiresAt`    | Date                                       | yes      | null      |
| `createdAt`    | Date                                       | no       | now       |

**Indexes:** `{inviteeEmail:1, status:1}` · `{itemId:1}` · `{expiresAt:1}` TTL. **Shard:** `{inviteeEmail:"hashed"}`.

---

## 13. `shared_with_me`

**Purpose:** per-grantee denormalized share index (anti-scatter-gather, §13.3). Derived from `drive_permissions` via outbox.

| Field        | Type                  | Nullable | Default |
| ------------ | --------------------- | -------- | ------- |
| `id`         | UUIDv7                | no       | gen     |
| `userId`     | UUIDv7                | no       | —       |
| `itemId`     | UUIDv7                | no       | —       |
| `role`       | enum `viewer\|editor` | no       | —       |
| `sharedById` | UUIDv7                | no       | —       |
| `sharedAt`   | Date                  | no       | now     |
| `removedAt`  | Date                  | yes      | null    |

**Constraints:** unique `{userId, itemId}` partial `{removedAt:null}`. **Indexes:** `{userId:1, removedAt:1, sharedAt:-1, _id:-1}`. **Sharding:** candidate only; the partial unique `{userId,itemId}` contract must be redesigned before hashed sharding.

---

## 14. `user_item_states`

**Purpose:** per-user flags (starred/pinned/hidden). Kept **out of** the shared item to avoid write contention.

| Field       | Type   | Nullable | Default |
| ----------- | ------ | -------- | ------- |
| `id`        | UUIDv7 | no       | gen     |
| `userId`    | UUIDv7 | no       | —       |
| `itemId`    | UUIDv7 | no       | —       |
| `isStarred` | bool   | no       | false   |
| `isPinned`  | bool   | no       | false   |
| `isHidden`  | bool   | no       | false   |
| `updatedAt` | Date   | no       | now     |

**Constraints:** unique `{userId, itemId}`. **Indexes:** `{userId:1, itemId:1}` unique · `{userId:1, isStarred:1, updatedAt:-1, _id:-1}`. **Sharding:** candidate only; keep unsharded while this compound uniqueness is database-enforced.

---

## 15. `user_item_activities`

**Purpose:** per-user last-viewed/open-count (recent). High write volume → Redis-buffered, batch-flushed.

| Field          | Type   | Nullable | Default |
| -------------- | ------ | -------- | ------- |
| `id`           | UUIDv7 | no       | gen     |
| `userId`       | UUIDv7 | no       | —       |
| `itemId`       | UUIDv7 | no       | —       |
| `lastViewedAt` | Date   | no       | now     |
| `lastOpenedAt` | Date   | no       | now     |
| `viewCount`    | int    | no       | 0       |
| `updatedAt`    | Date   | no       | now     |

**Constraints:** unique `{userId, itemId}`. **Indexes:** `{userId:1, itemId:1}` unique · `{userId:1, lastOpenedAt:-1, _id:-1}` (recent). **Sharding:** candidate only; keep unsharded while this compound uniqueness is database-enforced. **Write path:** open → Redis INCR/SET (keyed `userId:itemId`, short TTL) → worker batches every N s → upsert here. Never one Mongo write per click.

---

## 16. `item_shortcuts`

**Purpose:** personal shortcuts pointing at a target item.

| Field          | Type   | Nullable | Default |
| -------------- | ------ | -------- | ------- |
| `id`           | UUIDv7 | no       | gen     |
| `userId`       | UUIDv7 | no       | —       |
| `targetItemId` | UUIDv7 | no       | —       |
| `parentId`     | UUIDv7 | yes      | null    |
| `name`         | string | no       | —       |
| `createdAt`    | Date   | no       | now     |

**Indexes:** `{userId:1, parentId:1}` · `{targetItemId:1}`. **Shard:** `{userId:"hashed"}`.

---

## 17. `quota_accounts`

**Purpose:** per-user usage counter with **reservation** (fixes the race).

| Field           | Type   | Nullable | Default      | Notes                   |
| --------------- | ------ | -------- | ------------ | ----------------------- |
| `userId`        | UUIDv7 | no       | —            | PK.                     |
| `quotaBytes`    | long   | no       | plan default |                         |
| `usedBytes`     | long   | no       | 0            | Committed.              |
| `reservedBytes` | long   | no       | 0            | Held by active uploads. |
| `updatedAt`     | Date   | no       | now          |                         |

**Constraints:** unique `{userId}`. Check: `usedBytes>=0`, `reservedBytes>=0`, `usedBytes+reservedBytes<=quotaBytes` (enforced by the atomic reserve, not a DB check). **Indexes:** `{userId:1}` unique. **Shard:** `{userId:1}`. **Reserve (atomic):**

```js
db.quota_accounts.findOneAndUpdate(
  { userId, $expr: { $lte: [{ $add: ["$usedBytes", "$reservedBytes", size] }, "$quotaBytes"] } },
  { $inc: { reservedBytes: size }, $set: { updatedAt: new Date() } },
  { returnDocument: "after" }
); // null → INSUFFICIENT_STORAGE (507)
```

Commit: `{$inc:{reservedBytes:-size, usedBytes:+actual}}`. Release: `{$inc:{reservedBytes:-size}}`.

---

## 18. `quota_transactions`

**Purpose:** reserve/commit/release ledger for reconciliation.

| Field             | Type                            | Nullable | Default |
| ----------------- | ------------------------------- | -------- | ------- |
| `id`              | UUIDv7                          | no       | gen     |
| `userId`          | UUIDv7                          | no       | —       |
| `uploadSessionId` | UUIDv7                          | yes      | null    |
| `type`            | enum `reserve\|commit\|release` | no       | —       |
| `bytes`           | long                            | no       | —       |
| `createdAt`       | Date                            | no       | now     |

**Indexes:** `{userId:1, createdAt:-1}`. **Shard:** `{userId:"hashed"}`. Nightly job: `usedBytes` vs `SUM(live file_versions.size)`; correct drift, log threshold breaches.

---

## 19. `item_activities`

**Purpose:** user-facing activity feed (upload/download/rename/move/copy/share/permission/delete/restore/version-restore).

| Field       | Type   | Nullable | Default |
| ----------- | ------ | -------- | ------- |
| `id`        | UUIDv7 | no       | gen     |
| `itemId`    | UUIDv7 | no       | —       |
| `actorId`   | UUIDv7 | no       | —       |
| `action`    | string | no       | —       |
| `metadata`  | object | yes      | {}      |
| `createdAt` | Date   | no       | now     |

**Indexes:** `{itemId:1, createdAt:-1}` · `{actorId:1, createdAt:-1}`. **Shard:** `{actorId:"hashed"}`.

---

## 20. `audit_logs`

**Purpose:** append-only compliance log. **Immutable** — never updated on rename/delete; records value at event time.

| Field       | Type   | Nullable | Default |
| ----------- | ------ | -------- | ------- |
| `id`        | UUIDv7 | no       | gen     |
| `actorId`   | UUIDv7 | yes      | null    |
| `itemId`    | UUIDv7 | yes      | null    |
| `action`    | string | no       | —       |
| `snapshot`  | object | yes      | {}      |
| `ip`        | string | yes      | null    |
| `createdAt` | Date   | no       | now     |

**No TTL** — archived to cold storage by a scheduled job. **Indexes:** `{itemId:1, createdAt:-1}` · `{actorId:1, createdAt:-1}` · `{action:1, createdAt:-1}`. **Shard:** `{_id:"hashed"}`.

---

## 21. `outbox_events`

**Purpose:** reliable domain-event handoff to BullMQ or another broker.

| Field           | Type   | Nullable | Default |
| --------------- | ------ | -------- | ------- |
| `id`            | UUIDv7 | no       | gen     |
| `aggregateType` | string | no       | —       |
| `aggregateId`   | UUIDv7 | no       | —       |
| `ownerId`       | UUIDv7 | yes      | null    |
| `type`          | string | no       | —       |
| `payload`       | object | no       | —       |
| `attempts`      | int    | no       | 0       |
| `nextAttemptAt` | Date   | no       | now     |
| `dispatchedAt`  | Date   | yes      | null    |
| `createdAt`     | Date   | no       | now     |

**Indexes:**

```js
db.outbox_events.createIndex({ dispatchedAt: 1, nextAttemptAt: 1, createdAt: 1, _id: 1 });
db.outbox_events.createIndex({ aggregateType: 1, aggregateId: 1, createdAt: 1 });
```

Rules:

- Write the outbox row in the same **short replica-set transaction** as the authoritative metadata change when atomic publication intent is required.
- Relay claims rows with CAS/lease semantics; delivery is at-least-once, so every consumer is idempotent.
- Store IDs and minimal facts, not large Mongoose documents or file payloads.
- Coalesce high-frequency derived updates such as `childCount` deltas.
- Do not independently shard the outbox by random `_id` while expecting upload finalization to remain a cheap single-shard transaction. Multi-shard transactions have a higher cost.
- TTL/archive dispatched rows only after operational replay requirements are met.

---

## 22. `processing_jobs`

**Purpose:** durable tracking and recovery for long-running file/folder operations.

| Field | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | UUIDv7 | no | gen |
| `ownerId` | UUIDv7 | no | — |
| `rootItemId` | UUIDv7 | yes | null |
| `type` | enum (`recursive_delete\|empty_trash\|folder_move_cascade\|folder_copy\|folder_restore\|storage_migration\|blob_gc_reconcile`) | no | — |
| `status` | enum `queued\|processing\|completed\|failed\|cancelled` | no | `queued` |
| `phase` | string | yes | null |
| `lastProcessedId` | UUIDv7 | yes | null |
| `processedCount` | long | no | 0 |
| `totalEstimate` | long | yes | null |
| `progress` | float | yes | null |
| `leaseOwner` | string | yes | null |
| `leaseExpiresAt` | Date | yes | null |
| `attempts` | int | no | 0 |
| `result` | object | yes | null |
| `error` | object | yes | null |
| `createdAt` | Date | no | now |
| `updatedAt` | Date | no | now |
| `completedAt` | Date | yes | null |

**Indexes:**

```js
db.processing_jobs.createIndex({ ownerId: 1, status: 1, createdAt: -1, _id: -1 });
db.processing_jobs.createIndex({ status: 1, leaseExpiresAt: 1 });
db.processing_jobs.createIndex({ rootItemId: 1, status: 1 });
db.processing_jobs.createIndex({ completedAt: 1 }, { expireAfterSeconds: 2592000 });
```

### Recursive job requirements

- Acquire a lease with CAS; reclaim expired leases.
- Process stable `_id`-ordered batches.
- Persist checkpoints after each committed batch.
- Every batch is idempotent.
- Root `drive_items.operationId` points to the active job.
- Conflicting rename/move/delete/upload-to-folder operations are rejected while the relevant subtree is locked.
- Verify final subtree invariants before clearing the root lock.
- Do not hold a MongoDB transaction across the whole recursive operation.
- `202 Accepted` is returned for work above the synchronous threshold; client polls the job resource or receives notification.

---

## 23. `idempotency_keys`

**Purpose:** request-replay protection. **TTL 24 h.**

| Field              | Type   | Nullable | Default |
| ------------------ | ------ | -------- | ------- |
| `key`              | string | no       | —       |
| `userId`           | UUIDv7 | no       | —       |
| `endpoint`         | string | no       | —       |
| `requestHash`      | string | no       | —       |
| `responseStatus`   | int    | no       | —       |
| `responseSnapshot` | object | no       | —       |
| `createdAt`        | Date   | no       | now     |
| `expiresAt`        | Date   | no       | now+24h |

**Constraints:** unique `{userId, endpoint, key}`. **Indexes:** `{userId:1, endpoint:1, key:1}` unique · `{expiresAt:1}` TTL `expireAfterSeconds:0`. **Sharding:** candidate only; the idempotency uniqueness strategy must be redesigned before hashed sharding. **Behavior:** hit + same `requestHash` → replay snapshot; hit + different hash → `IDEMPOTENCY_KEY_REUSED` (409); miss → execute + store.

---

## 24. `search_documents`

**Purpose:** search projection. Phase-1 sink = MongoDB (Atlas Search / text index); OpenSearch only when justified.

| Field            | Type                | Nullable | Default    |
| ---------------- | ------------------- | -------- | ---------- |
| `id`             | UUIDv7              | no       | (= itemId) |
| `ownerId`        | UUIDv7              | no       | —          |
| `name`           | string              | no       | —          |
| `normalizedName` | string              | no       | —          |
| `type`           | enum `file\|folder` | no       | —          |
| `mimeType`       | string              | yes      | null       |
| `extension`      | string              | yes      | null       |
| `isDeleted`      | bool                | no       | false      |
| `updatedAt`      | Date                | no       | now        |

**Indexes:** `{ownerId:1, isDeleted:1}` + text/Atlas-Search index on `name`. **Shard:** `{ownerId:"hashed"}`. Built from outbox (`item_created/renamed/deleted`).

---

## 25. TTL index summary

| Collection          | Field                         | expireAfterSeconds      |
| ------------------- | ----------------------------- | ----------------------- |
| `refresh_tokens`    | `expiresAt`                   | 0                       |
| `upload_sessions`   | `expiresAt`                   | 0                       |
| `share_links`       | `expiresAt`                   | 0                       |
| `share_invitations` | `expiresAt`                   | 0                       |
| `idempotency_keys`  | `expiresAt`                   | 0                       |
| `processing_jobs`   | `completedAt`                 | 2,592,000 (30 d)        |
| `outbox_events`     | `createdAt` (dispatched only) | 604,800 (7 d, optional) |

`audit_logs` and `security_audit_events` intentionally have **no TTL** — cold-archived, not deleted.

---

## 26. Change summary vs v2 (schema level)

Existing v2→current changes remain, with the following scale-review corrections:

- **`drive_items`:** separated file lifecycle `status` from recursive `operationState`; added `operationId`, `nextVersionNumber`, bounded depth, cursor/list index variants, and explicit recursive-operation locking.
- **Hierarchy:** `ancestorIds` retained because it makes navigation, subtree lookup, and permission inheritance fast; large move/delete/restore remains `O(subtree size)` and is processed asynchronously.
- **`childCount`:** defined as eventually consistent direct active/non-deleted count; worker deltas are coalesced and never used as the source of truth.
- **`file_blobs`:** dedup scoped by owner/workspace; corrected GC to `pending_deletion→deleting→deleted`; added safe grace-period revive and release of the unique dedup slot before physical deletion.
- **`file_versions`:** added owner scope and atomic version-number allocation from the item.
- **Uploads:** expanded session states, added explicit reaper and clarified that TTL is only a safety net.
- **Outbox/jobs:** added retry, lease, checkpoint, and idempotency fields; warned against independently sharding the outbox/core and creating distributed transactions.
- **Sharding:** all shard comments are candidates only. The previous core shard keys are not approved because several conflict with unique-index requirements or create expensive cross-shard workflows.

---

## 27. File/folder performance scorecard

| Area | Rating | Reason |
| --- | --: | --- |
| Root/folder children list | **Strong** | equality-prefix compound indexes + cursor pagination |
| Item metadata lookup | **Strong** | unique external ID lookup |
| Folder breadcrumb | **Strong** | bounded `ancestorIds` + batch name fetch |
| Permission inheritance | **Strong** | self+ancestor ID lookup; no per-descendant ACL copies |
| Large folder listing | **Strong if cursor-only** | cost scales with page size, not page number |
| File version history | **Strong** | immutable rows ordered by `(itemId, versionNumber)` |
| Upload recovery | **Strong after updates** | explicit session state, quota reservation, reaper, idempotent finalize |
| Dedup/GC | **Medium→Strong after updates** | scoped dedup and corrected GC; refcount hotspot still requires monitoring |
| Rename/move file | **Strong** | bounded single-item update |
| Move/delete/restore huge folder | **Inherently expensive** | materialized ancestry/trash state requires subtree writes |
| `childCount` under a very hot folder | **Medium** | one parent is a contention point unless deltas are coalesced |
| Core sharding readiness | **Not ready as previously written** | unique-index and transaction-locality conflicts |
| Search/recent/shared projections | **Strong architecture** | asynchronous derived collections protect the core path |

### Overall scale judgment

The file/folder model is suitable for a serious production system and can grow far beyond an MVP on a well-sized replica set. Its primary read paths are efficient. The limiting factors will not normally be “number of users” alone; they will be:

- total hot working set;
- largest folder and subtree;
- upload/version concurrency;
- one-folder mutation rate;
- blob-ref contention;
- recursive-job throughput;
- storage/checksum/scan latency;
- whether core writes remain local rather than distributed across shards.

Do not claim one million concurrent users from schema alone. Prove capacity with representative data and SLO-based load tests.

---

## 28. Required benchmark matrix

Prepare datasets and tests for at least:

| Test | Dataset/concurrency | Verify |
| --- | --- | --- |
| Root list | millions of users/items distributed normally | P50/P95/P99, keys/docs examined, cache hit |
| Huge folder list | 100k–1M direct children | cursor stability, no blocking sort, no skip degradation |
| Deep breadcrumb | depth 32, 128, 256 | bounded response and permission cost |
| Same-name upload race | 100 concurrent uploads to one parent/name | one active winner, complete cleanup, no quota/blob leak |
| Hot parent | thousands of child creates/deletes per minute | child-count coalescing, parent-doc contention |
| Version race | 100 concurrent versions on one file | monotonic unique version numbers, correct current version |
| Dedup hotspot | many references to one scoped hash | refCount CAS latency and drift |
| Large move | 1k, 100k, 1M descendants | batch checkpoint/retry, lock semantics, recovery |
| Large recursive trash/restore | mixed files/folders | invariant checks and idempotency |
| Worker crash | crash at every state transition | no permanent upload/blob/quota/tree inconsistency |
| Storage outage | timeout/partial failure | bounded retries, no request-thread exhaustion |

For MongoDB queries, retain `explain("executionStats")` evidence and alert on:

- `COLLSCAN` on hot endpoints;
- `docsExamined / nReturned` growth;
- in-memory/blocking sorts;
- index size and cache pressure;
- replication lag;
- transaction abort/retry rate;
- long-running recursive jobs;
- orphan upload/blob/version/quota discrepancies.

---

## 29. Recommended implementation order for file/folder core

1. Implement `drive_items` on a replica set with cursor children list and unique active names.
2. Implement folder create/detail/breadcrumb/rename and single-item move.
3. Add `operationState`, processing jobs, and batched recursive delete/move/restore before allowing large trees.
4. Implement storage abstraction and `upload_sessions`.
5. Implement short, idempotent upload finalization with quota, blob, version, item, and outbox consistency.
6. Add download/preview streaming and Range support.
7. Add scoped dedup and GC only after non-deduplicated upload correctness is proven.
8. Add permissions and shared projections.
9. Add search/activity projections.
10. Benchmark, remove unused indexes, and only then review sharding.

---

## 30. Official MongoDB design basis

- Unique indexes on sharded collections require the shard key as the unique-index prefix: https://www.mongodb.com/docs/manual/core/sharding-shard-key-indexes/
- Partial unique indexes enforce uniqueness only for matching documents: https://www.mongodb.com/docs/manual/core/index-partial/
- Multikey indexes support array-field queries such as `ancestorIds`: https://www.mongodb.com/docs/manual/core/indexes/index-types/index-multikey/
- Monotonically changing shard keys can create insert concentration: https://www.mongodb.com/docs/manual/core/sharding-troubleshooting-shard-keys/
- Multi-shard transactions have a higher performance cost: https://www.mongodb.com/docs/manual/core/transactions-sharded-clusters/
- TTL deletion is not immediate: https://www.mongodb.com/docs/manual/core/index-ttl/
- Avoid unbounded arrays: https://www.mongodb.com/docs/manual/data-modeling/design-antipatterns/unbounded-arrays/
- Use bounded pagination instead of large skip/limit combinations: https://www.mongodb.com/docs/manual/troubleshooting/slow-queries-in-production/
