import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsMongoId,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { Transform } from "class-transformer";
import { DriveItemNameDto } from "../../drive-items/dto/requests/drive-item-name.dto";

import "reflect-metadata";

export const SINGLE_PART_MAX_BYTES = 8 * 1024 * 1024; // 8 MB
export const MIN_PART_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB
export const MAX_PARTS_ALLOWED = 9000;

export class InitUploadDto extends DriveItemNameDto {
  @Transform(({ value }) => (value === "" ? null : value))
  @IsOptional()
  @IsMongoId()
  parentId?: string | null;

  @IsNumberString()
  declaredSizeBytes!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-f0-9]{64}$/i)
  declaredChecksumSha256Hex?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  mimeTypeHint?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  idempotencyKey!: string;
}

export class CompletePartDto {
  @IsInt()
  @Min(1)
  @Max(MAX_PARTS_ALLOWED)
  partNumber!: number;

  @IsString()
  etag!: string;

  @IsNumberString()
  sizeBytes!: string;
}

export class CompleteUploadDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PARTS_ALLOWED)
  @ArrayUnique((part: CompletePartDto) => part.partNumber)
  @ValidateNested({ each: true })
  @Type(() => CompletePartDto)
  parts?: CompletePartDto[]; // omitted for single-part method

  @IsOptional()
  @IsString()
  @Matches(/^[a-f0-9]{64}$/i)
  clientChecksumSha256Hex?: string;
}

export class UploadStatusParamDto {
  @IsMongoId()
  id!: string;
}

export interface UploadPartUrlDto {
  partNumber: number;
  url: string;
}

export interface InitUploadResponseDto {
  uploadSessionId: string;
  method: "single" | "multipart";
  putUrl?: string;
  partSizeBytes?: number;
  expectedPartsCount?: number;
  partUrls?: UploadPartUrlDto[];
  expiresAt: Date;
}

export interface ResumeUploadResponseDto {
  status: string;
  driveItemId?: string;
  singlePartUploaded?: boolean;
  totalParts?: number;
  uploadedPartCount?: number;
  uploadedParts?: Array<{ partNumber: number; etag: string; sizeBytes: string }>;
  missingPartUrls?: UploadPartUrlDto[];
}
