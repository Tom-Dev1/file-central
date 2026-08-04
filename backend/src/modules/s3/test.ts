import { Injectable, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { S3_CONFIG_TOKEN, S3ConfigShape } from "src/configs";

export interface PresignedUploadInfo {
  key: string;
  url: string;
  method: "PUT";
  expiresInSeconds: number;
}

// --- Multipart upload types ---

export interface MultipartPartUrl {
  partNumber: number;
  url: string;
}

export interface InitMultipartUploadResult {
  key: string;
  uploadId: string;
  parts: MultipartPartUrl[];
  partSizeBytes: number;
  expiresInSeconds: number;
}

export interface CompletedPartInput {
  partNumber: number;
  eTag: string;
}

export interface UploadProgress {
  uploadId: string;
  key: string;
  totalParts: number;
  uploadedParts: number;
  percentage: number;
}

// 5MB — giới hạn tối thiểu của S3 cho mọi part trừ part cuối cùng.
const MIN_PART_SIZE_BYTES = 5 * 1024 * 1024;
// Mặc định chia part 8MB nếu không truyền vào — cân bằng giữa số request và tốc độ song song.
const DEFAULT_PART_SIZE_BYTES = 8 * 1024 * 1024;
// S3 giới hạn tối đa 10,000 parts / 1 multipart upload.
const MAX_PARTS = 10_000;

/**
 * S3Service — wraps AWS SDK v3 + s3-request-presigner to sign short-lived PUT/GET URLs.
 * Bổ sung cơ chế Multipart (Chunked) Upload cho file lớn kèm progress tracking.
 */
@Injectable()
export class S3Service {
  private readonly cfg: S3ConfigShape;

  constructor(private readonly s3: S3Client, configService: ConfigService) {
    this.cfg = configService.getOrThrow<S3ConfigShape>(S3_CONFIG_TOKEN);
  }

  //Sign a PUT URL so the client uploads directly — bypassing the backend.
  async createUploadUrl(contentType: string): Promise<PresignedUploadInfo> {
    const key = `${Date.now()}-${randomUUID()}`;
    const command = new PutObjectCommand({
      Bucket: this.cfg.bucket,
      Key: key,
      ContentType: contentType,
    });
    const url = await getSignedUrl(this.s3, command, {
      expiresIn: this.cfg.presignExpiresSeconds,
    });
    return { key, url, method: "PUT", expiresInSeconds: this.cfg.presignExpiresSeconds };
  }

  /**
   * Sign a short-lived GET URL — the bucket stays private but allows temporary downloads.
   */
  async createDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key });
    return getSignedUrl(this.s3, command, {
      expiresIn: this.cfg.presignExpiresSeconds,
    });
  }

  // ============================================================
  // ===============  MULTIPART (CHUNKED) UPLOAD  ===============
  // ============================================================

  /**
   * Bước 1: Khởi tạo multipart upload.
   * Trả về uploadId + danh sách presigned URL cho từng part để client upload trực tiếp song song lên S3.
   *
   * @param contentType MIME type của file
   * @param fileSizeBytes Tổng kích thước file (client phải biết trước, vd từ File.size)
   * @param partSizeBytes Kích thước mỗi part, mặc định 8MB, tối thiểu 5MB (trừ part cuối)
   */
  async initMultipartUpload(
    contentType: string,
    fileSizeBytes: number,
    partSizeBytes: number = DEFAULT_PART_SIZE_BYTES
  ): Promise<InitMultipartUploadResult> {
    if (fileSizeBytes <= 0) {
      throw new BadRequestException("fileSizeBytes phải > 0");
    }
    if (partSizeBytes < MIN_PART_SIZE_BYTES) {
      throw new BadRequestException(`partSizeBytes tối thiểu ${MIN_PART_SIZE_BYTES} bytes (5MB) theo quy định của S3`);
    }

    const totalParts = Math.ceil(fileSizeBytes / partSizeBytes);
    if (totalParts > MAX_PARTS) {
      throw new BadRequestException(
        `File quá lớn: cần ${totalParts} parts, vượt giới hạn ${MAX_PARTS} của S3. Hãy tăng partSizeBytes.`
      );
    }

    const key = `${Date.now()}-${randomUUID()}`;

    const createCommand = new CreateMultipartUploadCommand({
      Bucket: this.cfg.bucket,
      Key: key,
      ContentType: contentType,
    });
    const { UploadId } = await this.s3.send(createCommand);
    if (!UploadId) {
      throw new Error("S3 không trả về UploadId khi khởi tạo multipart upload");
    }

    // Ký presigned URL cho từng part — client tự PUT trực tiếp, không qua backend.
    const parts: MultipartPartUrl[] = await Promise.all(
      Array.from({ length: totalParts }, (_, i) => i + 1).map(async (partNumber) => {
        const uploadPartCommand = new UploadPartCommand({
          Bucket: this.cfg.bucket,
          Key: key,
          UploadId,
          PartNumber: partNumber,
        });
        const url = await getSignedUrl(this.s3, uploadPartCommand, {
          expiresIn: this.cfg.presignExpiresSeconds,
        });
        return { partNumber, url };
      })
    );

    return {
      key,
      uploadId: UploadId,
      parts,
      partSizeBytes,
      expiresInSeconds: this.cfg.presignExpiresSeconds,
    };
  }

  /**
   * Bước 2 (tuỳ chọn): Client gọi định kỳ để backend biết đã upload xong bao nhiêu part
   * — dùng để hiển thị progress ở phía server (vd khi nhiều client cùng theo dõi 1 job),
   * hoặc để phục hồi (resume) upload khi client bị mất kết nối giữa chừng.
   */
  async getUploadProgress(key: string, uploadId: string, totalParts: number): Promise<UploadProgress> {
    const command = new ListPartsCommand({
      Bucket: this.cfg.bucket,
      Key: key,
      UploadId: uploadId,
    });
    const result = await this.s3.send(command);
    const uploadedParts = result.Parts?.length ?? 0;

    return {
      uploadId,
      key,
      totalParts,
      uploadedParts,
      percentage: totalParts > 0 ? Math.round((uploadedParts / totalParts) * 100) : 0,
    };
  }

  /**
   * Bước 3: Sau khi client upload xong TẤT CẢ part và có ETag của từng part
   * (lấy từ response header "ETag" của mỗi request PUT), gọi hàm này để S3 ghép file lại.
   */
  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: CompletedPartInput[]
  ): Promise<{ key: string; location?: string }> {
    if (!parts.length) {
      throw new BadRequestException("Danh sách parts rỗng, không thể complete multipart upload");
    }

    // S3 yêu cầu parts phải được sắp xếp tăng dần theo PartNumber.
    const sortedParts = [...parts].sort((a, b) => a.partNumber - b.partNumber);

    const command = new CompleteMultipartUploadCommand({
      Bucket: this.cfg.bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: sortedParts.map((p) => ({
          PartNumber: p.partNumber,
          ETag: p.eTag,
        })),
      },
    });

    try {
      const result = await this.s3.send(command);
      return { key, location: result.Location };
    } catch (err) {
      // Nếu complete thất bại (vd thiếu part, ETag sai), nên abort để dọn rác trên S3.
      await this.abortMultipartUpload(key, uploadId).catch(() => undefined);
      throw err;
    }
  }

  /**
   * Huỷ multipart upload — gọi khi user cancel, hoặc khi có lỗi giữa chừng,
   * để tránh S3 tính phí lưu trữ cho các part chưa được complete.
   */
  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    const command = new AbortMultipartUploadCommand({
      Bucket: this.cfg.bucket,
      Key: key,
      UploadId: uploadId,
    });
    await this.s3.send(command);
  }
}
