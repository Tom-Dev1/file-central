import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { Types } from "mongoose";

import { UploadsService } from "./uploads.service";
import { InitUploadDto, CompleteUploadDto, UploadStatusParamDto } from "./dto/upload.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";

@UseGuards(JwtAuthGuard)
@Controller("uploads")
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) { }

  /**
   * Khởi tạo upload. Server quyết single/multipart, trả presigned URL.
   * POST /uploads
   */
  @Post()
  async init(@CurrentUser() user: AuthUser, @Body() dto: InitUploadDto) {
    return this.uploadsService.initUpload(new Types.ObjectId(user.userId), dto);
  }

  /**
   * Trạng thái / resume sau mất mạng.
   * GET /uploads/:id/status
   */
  @Get(":id/status")
  async status(@CurrentUser() user: AuthUser, @Param() params: UploadStatusParamDto) {
    return this.uploadsService.getStatus(new Types.ObjectId(user.userId), new Types.ObjectId(params.id));
  }

  /**
   * Hoàn tất upload -> activate file.
   * POST /uploads/:id/complete
   */
  @Post(":id/complete")
  @HttpCode(200)
  async complete(@CurrentUser() user: AuthUser, @Param() params: UploadStatusParamDto, @Body() dto: CompleteUploadDto) {
    return this.uploadsService.completeUpload(new Types.ObjectId(user.userId), new Types.ObjectId(params.id), dto);
  }

  /**
   * Huỷ upload đang dở.
   * POST /uploads/:id/abort
   */
  @Post(":id/abort")
  @HttpCode(200)
  async abort(@CurrentUser() user: AuthUser, @Param() params: UploadStatusParamDto) {
    return this.uploadsService.abortUpload(new Types.ObjectId(user.userId), new Types.ObjectId(params.id));
  }
}
