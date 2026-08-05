# Drive Core - Remaining Work

Audit source: `docs/drive-core-design.md`.

## P0 - Data consistency and authorization

- [x] Make upload activation and quota commit compensatable. A failed quota commit must never leave an active drive item pointing to deleted storage.
- [x] Detect MIME and extension from object magic bytes for both direct and presigned uploads. Do not trust client `Content-Type`.
- [x] Enforce permission checks when listing children of a shared folder.
- [x] Remove raw public-link tokens from MongoDB; store SHA-256 hashes and return one public error for unknown, expired, or revoked links.
- [ ] Clean up permissions, share links, and user item states during permanent delete. Share records are handled; dedicated permission and user-state collections are not implemented yet.

## P1 - Tree correctness and scalability

- [x] Replace offset pagination with cursor pagination matching the compound indexes.
- [x] Maintain approximate `childCount` on create, activate, move, trash, and restore. Permanent delete needs no second decrement after trash.
- [x] Add a periodic `childCount` reconciliation job.
- [x] Validate the deepest descendant before moving a folder so the resulting depth never exceeds 64.
- [ ] Make subtree move/trash/restore resumable or transactional; keep the synchronous threshold at 1,000 items.
- [ ] Preflight name collisions for every item restored from a trashed subtree.

## P2 - Operational hardening

- [x] Add retry worker for `storage_objects.state=delete_failed`.
- [ ] Add schema-level validation for file/folder and trash invariants.
- [x] Consolidate duplicate public `DriveItemResponseDto` definitions.
- [x] Replace permission parent walking with the stored `ancestorIds` chain.
- [ ] Add data migration for legacy `isDeleted/deletedAt/objectKey/bucket/Number sizeBytes` documents.
- [ ] Add integration tests against MongoDB and MinIO for upload compensation, move, trash/restore, purge, permission inheritance, and public links.

## Verification baseline

- `npm run build` passes.
- `git diff --check` passes.
- Jest and `ts-jest` are aligned on major 29; the current unit suite passes.
