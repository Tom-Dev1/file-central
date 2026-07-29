import { plainToInstance } from "class-transformer";
import { DriveItemResponseDto } from "../dto/drive-item-response.dto";
import { ShareResponseDto } from "../dto/share-response.dto";

// Normalizes a Mongoose HydratedDocument (has .toObject)
function toPlain(doc: any): any {
  if (!doc) return doc;
  return typeof doc.toObject === "function" ? doc.toObject() : doc;
}

export function toDriveItemDto(doc: any): DriveItemResponseDto {
  return plainToInstance(DriveItemResponseDto, toPlain(doc), { excludeExtraneousValues: true });
}

export function toDriveItemDtoList(docs: any[]): DriveItemResponseDto[] {
  return docs.map(toDriveItemDto);
}

export function toShareDto(doc: any): ShareResponseDto {
  return plainToInstance(ShareResponseDto, toPlain(doc), { excludeExtraneousValues: true });
}

export function toShareDtoList(docs: any[]): ShareResponseDto[] {
  return docs.map(toShareDto);
}
