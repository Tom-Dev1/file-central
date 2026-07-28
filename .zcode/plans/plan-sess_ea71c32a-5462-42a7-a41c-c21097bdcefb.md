## Mục tiêu
Thêm 2 field `lastModifiedAt` và `lastViewedAt` vào DriveItem để frontend hiển thị "Last modified" và "Last viewed" cho người dùng. Cập nhật tự động theo từng loại action.

## Quyết định thiết kế (theo câu trả lời của bạn)
- **Tách 2 field riêng biệt** (không gộp).
- **`lastViewedAt` là global** (1 timestamp cho file, không per-user) — đủ cho MVP.

## Bảng mapping action → field

| Action | Endpoint | Service | Cập nhật |
|---|---|---|---|
| Upload file | `POST /files/upload` | `files.service.ts:35` | `lastModifiedAt` + `lastViewedAt` = now (vừa tạo) |
| Create folder | `POST /folders` | `folders.service.ts:11` | `lastModifiedAt` + `lastViewedAt` = now |
| Rename | `PATCH /drive/:id/rename` | `drive.service.ts:79` | `lastModifiedAt` = now |
| Move | `PATCH /drive/:id/move` | `drive.service.ts:93` | `lastModifiedAt` = now |
| Download | `GET /files/:id/download` | `files.service.ts:78` | `lastViewedAt` = now |
| Preview-link | `GET /files/:id/preview-link` | `files.service.ts:95` | `lastViewedAt` = now |
| GetById | `GET /drive/:id` | `drive.service.ts:55` | `lastViewedAt` = now |

**Quan trọng về ngữ nghĩa**:
- `updatedAt` của Mongoose (đang được frontend dùng làm "Last modified") **không đáng tin cậy** vì nó auto-bump khi save bất kỳ field nào (kể cả khi chỉ set `lastViewedAt`). Nên dùng field tường minh `lastModifiedAt`.
- Khi chỉ cập nhật `lastViewedAt`, phải dùng `findByIdAndUpdate(..., { timestamps: false })` để Mongoose **không** auto-bump `updatedAt` (tránh nhiễu cột "Last modified").

## Thay đổi

### 1. `src/drive-items/schemas/drive-item.schema.ts` — thêm 2 field
```ts
@Prop({ type: Date, default: null })
lastModifiedAt?: Date | null;

@Prop({ type: Date, default: null })
lastViewedAt?: Date | null;
```
- File cũ trong DB sẽ có `null` cho tới khi được chạm lần đầu → frontend cần handle null (hiển thị "—" hoặc ẩn). Mình sẽ ghi chú rõ cho frontend.

### 2. `src/common/dto/drive-item-response.dto.ts` — expose 2 field
```ts
@ApiPropertyOptional({ nullable: true })
@Expose()
lastModifiedAt?: Date | null;

@ApiPropertyOptional({ nullable: true })
@Expose()
lastViewedAt?: Date | null;
```

### 3. `src/drive-items/drive-items.service.ts` — thêm helper `touchViewed`
Thêm method centralized để tránh lặp logic ở 3 nơi (download, preview, getById):
```ts
async touchViewed(itemId: Types.ObjectId): Promise<void> {
  await this.driveItemModel.findByIdAndUpdate(
    itemId,
    { $set: { lastViewedAt: new Date() } },
    { timestamps: false }   // KHÔNG bump updatedAt khi chỉ xem
  );
}
```

### 4. `src/files/files.service.ts`
- **Upload** (`create({...})` ở dòng ~56): thêm `lastModifiedAt: new Date(), lastViewedAt: new Date()`.
- **getDownloadStream** (dòng 78): sau khi check item, gọi `this.driveItemsService.touchViewed(objectId)` (fire-and-forget, không block stream).
- **getPreviewLink** (dòng 95): tương tự gọi `touchViewed`.

### 5. `src/folders/folders.service.ts`
- **create**: thêm `lastModifiedAt: new Date(), lastViewedAt: new Date()`.

### 6. `src/drive/drive.service.ts`
- **rename** (dòng 88): thêm `item.lastModifiedAt = new Date();` trước `item.save()`.
- **move** (dòng 113): thêm `item.lastModifiedAt = new Date();` trước `item.save()`.
- **getById** (dòng 55): sau khi lấy item, gọi `touchViewed` (fire-and-forget). Lưu ý: `getById` có thể dùng cho cả mục đích nội bộ khác (breadcrumb), nên chỉ touch khi là endpoint public. Kiểm tra: `getById` chỉ được gọi từ `DriveController.getById` → an toàn để touch.

## Fire-and-forget cho touchViewed
Các action đọc (download/preview/getById) không cần chờ `lastViewedAt` update xong mới trả response — ghi log async, bắt lỗi âm thầm:
```ts
this.driveItemsService.touchViewed(objectId).catch((err) =>
  this.logger.warn(`Failed to update lastViewedAt for ${objectId}: ${err.message}`)
);
```
→ Không làm chậm response, không fail request nếu DB update lỗi.

## Các file KHÔNG chạm
- `files.controller.ts`, `folders.controller.ts`, `drive.controller.ts` — signature service không đổi.
- Frontend — sẽ tự nhận `lastModifiedAt`/`lastViewedAt` từ response (đã có `@Expose`). Frontend cần đổi UI để dùng field mới thay vì `updatedAt`, nhưng đó là task riêng.

## Test scenarios (xác nhận sau code)
1. Upload file → response có `lastModifiedAt` ≈ `lastViewedAt` ≈ now, `updatedAt` cũng ≈ now.
2. Preview-link 1 file → `lastViewedAt` cập nhật, `lastModifiedAt` KHÔNG đổi, `updatedAt` KHÔNG bump.
3. Download file → giống #2.
4. Rename file → `lastModifiedAt` cập nhật, `lastViewedAt` không đổi.
5. Move file → `lastModifiedAt` cập nhật.
6. File cũ (tạo trước lần deploy này) → 2 field = null, không crash.
7. `tsc --noEmit` sạch.

## Rủi ro & xử lý
- **TouchViewed tăng tải DB**: mỗi lần download/preview/getById = 1 thêm `findByIdAndUpdate`. Với MVP OK. Nếu sau này user list folder và mỗi file tự fetch getById → có thể sinh ra nhiều update thừa. Giải pháp: frontend chỉ touch khi user thực sự mở file (click preview/download), không tự động touch khi list. Ghi chú cho frontend.
- **Data cũ null**: frontend phải handle null case (hiển thị "—" hoặc fallback về `createdAt`/`updatedAt`). Ghi chú rõ.