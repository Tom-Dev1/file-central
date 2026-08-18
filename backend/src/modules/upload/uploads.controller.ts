import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { Types } from "mongoose";

import { InitUploadDto, CompleteUploadDto, UploadStatusParamDto } from "./dto/upload.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "../../common/decorators/current-user.decorator";
import { CompleteUploadUseCase } from "./application/complete-upload.use-case";
import { GetUploadStatusUseCase } from "./application/get-upload-status.use-case";
import { InitUploadUseCase } from "./application/init-upload.use-case";
import { PauseUploadUseCase } from "./application/pause-upload.use-case";
import { AbortUploadUseCase } from "./application/abort-upload.use-case";

@UseGuards(JwtAuthGuard)
@Controller("uploads")
export class UploadsController {
  constructor(
    private readonly initUpload: InitUploadUseCase,
    private readonly getUploadStatus: GetUploadStatusUseCase,
    private readonly completeUpload: CompleteUploadUseCase,
    private readonly pauseUpload: PauseUploadUseCase,
    private readonly abortUpload: AbortUploadUseCase,
  ) {}

  /**
   * Khởi tạo upload. Server quyết single/multipart, trả presigned URL.
   * POST /uploads
   */
  @Post()
  async init(@CurrentUser() user: AuthUser, @Body() dto: InitUploadDto) {
    return this.initUpload.execute(new Types.ObjectId(user.userId), dto);
  }

  /**
   * Trạng thái / resume sau mất mạng.
   * GET /uploads/:id/status
   */
  @Get(":id/status")
  async status(@CurrentUser() user: AuthUser, @Param() params: UploadStatusParamDto) {
    return this.getUploadStatus.execute(
      new Types.ObjectId(user.userId),
      new Types.ObjectId(params.id),
    );
  }

  /**
   * Hoàn tất upload -> activate file.
   * POST /uploads/:id/complete
   */
  @Post(":id/complete")
  @HttpCode(200)
  async complete(@CurrentUser() user: AuthUser, @Param() params: UploadStatusParamDto, @Body() dto: CompleteUploadDto) {
    return this.completeUpload.execute(
      new Types.ObjectId(user.userId),
      new Types.ObjectId(params.id),
      dto,
    );
  }

  /** Tạm dừng upload để có thể resume bằng cùng session. */
  @Post(":id/pause")
  @HttpCode(200)
  async pause(@CurrentUser() user: AuthUser, @Param() params: UploadStatusParamDto) {
    return this.pauseUpload.execute(
      new Types.ObjectId(user.userId),
      new Types.ObjectId(params.id),
    );
  }

  /** Huỷ upload và dọn storage, quota cùng placeholder chưa hoàn tất. */
  @Post(":id/abort")
  @HttpCode(200)
  async abort(@CurrentUser() user: AuthUser, @Param() params: UploadStatusParamDto) {
    return this.abortUpload.execute(
      new Types.ObjectId(user.userId),
      new Types.ObjectId(params.id),
    );
  }
}
