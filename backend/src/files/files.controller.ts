import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { randomUUID } from "crypto";
import { extname } from "path";
import { tmpdir } from "os";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { FilesService } from "./files.service";
import { UploadFileDto } from "./dto/upload-file.dto";
import { toDriveItemDto } from "../common/mappers/response-mapper";

const UPLOAD_TMP_DIR = process.env.UPLOAD_TMP_DIR || `${tmpdir()}/file-central-uploads`;

@ApiTags("files")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("files")
export class FilesController {
  constructor(private filesService: FilesService) {}

  @Post("upload")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: UPLOAD_TMP_DIR,
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: parseInt(process.env.MAX_UPLOAD_SIZE_MB || "200", 10) * 1024 * 1024,
      },
    })
  )
  async upload(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File, @Body() body: UploadFileDto) {
    if (!file) {
      throw new BadRequestException("file is required");
    }
    const created = await this.filesService.upload(user.userId, body?.parentId ?? null, file);
    return toDriveItemDto(created);
  }

  @Get(":id/download")
  async download(@CurrentUser() user: AuthUser, @Param("id") id: string, @Res({ passthrough: false }) res: Response) {
    const { stream, name, mimeType, size } = await this.filesService.getDownloadStream(user.userId, user.email, id);

    res.setHeader("Content-Type", mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(name)}"`);
    if (size) {
      res.setHeader("Content-Length", size.toString());
    }
    stream.pipe(res);
  }

  @Get(":id/preview-link")
  previewLink(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.filesService.getPreviewLink(user.userId, user.email, id);
  }
}
