import { BadRequestException, Body, Controller, Get, Param, Post, Res, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { tmpdir } from 'os';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { FilesService } from './files.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { toDriveItemDto } from '../../common/mappers/response-mapper';
import type { Response } from 'express';

const UPLOAD_TMP_DIR = process.env.UPLOAD_TMP_DIR || `${tmpdir()}/file-central-uploads`;

@ApiTags('files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: UPLOAD_TMP_DIR,
      filename: (_request, file, callback) => callback(null, `${randomUUID()}${extname(file.originalname)}`),
    }),
    limits: { fileSize: Number.parseInt(process.env.MAX_UPLOAD_SIZE_MB || '200', 10) * 1024 * 1024 },
  }))
  async upload(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File, @Body() body: UploadFileDto) {
    if (!file) throw new BadRequestException('file is required');
    return toDriveItemDto(await this.filesService.upload(user.userId, body?.parentId ?? null, file));
  }

  @Get(':id/download')
  async download(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.filesService.getDownloadStream(user.userId, user.email, id);
    const safeName = file.fileName.replace(/["\\\r\n]/g, '_');
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Length', file.contentLength);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
    );
    return new StreamableFile(file.stream);
  }

  @Get(':id/preview')
  preview(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.filesService.getPreviewUrl(user.userId, user.email, id);
  }
}
