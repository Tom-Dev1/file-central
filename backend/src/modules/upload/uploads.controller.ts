import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { Types } from "mongoose";

import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CompleteUploadDto, InitUploadDto, UploadStatusParamDto } from "./dto/upload.dto";
import { UploadsService } from "./uploads.service";

@Controller("uploads")
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  init(@CurrentUser() user: AuthUser, @Body() dto: InitUploadDto) {
    return this.uploadsService.initUpload(new Types.ObjectId(user.userId), dto);
  }

  /** Reconciles uploaded chunks with object storage and returns URLs only for missing chunks. */
  @Get(":id/status")
  status(@CurrentUser() user: AuthUser, @Param() params: UploadStatusParamDto) {
    return this.uploadsService.getStatus(new Types.ObjectId(user.userId), new Types.ObjectId(params.id));
  }

  @Post(":id/complete")
  complete(
    @CurrentUser() user: AuthUser,
    @Param() params: UploadStatusParamDto,
    @Body() dto: CompleteUploadDto,
  ) {
    return this.uploadsService.completeUpload(
      new Types.ObjectId(user.userId),
      new Types.ObjectId(params.id),
      dto,
    );
  }

  @Post(":id/abort")
  abort(@CurrentUser() user: AuthUser, @Param() params: UploadStatusParamDto) {
    return this.uploadsService.abortUpload(new Types.ObjectId(user.userId), new Types.ObjectId(params.id));
  }
}
