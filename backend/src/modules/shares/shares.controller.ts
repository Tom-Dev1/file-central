import { Body, Controller, Delete, Get, Param, Post, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { SharesService } from "./shares.service";
import { CreateShareDto } from "./dto/create-share.dto";
import { toDriveItemDto, toDriveItemDtoList, toShareDto, toShareDtoList } from "../../common/mappers/response-mapper";
import { AuthUser, CurrentUser } from "src/common/decorators/current-user.decorator";

@ApiTags("shares")
@Controller("shares")
export class SharesController {
  constructor(private sharesService: SharesService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateShareDto) {
    const share = await this.sharesService.create(user.userId, dto);
    return toShareDto(share);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  async listMine(@CurrentUser() user: AuthUser) {
    const shares = await this.sharesService.listMyShares(user.userId);
    return toShareDtoList(shares);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get("shared-with-me")
  async sharedWithMe(@CurrentUser() user: AuthUser) {
    const rows = await this.sharesService.listSharedWithMe(user.userId, user.email);
    return rows.map((row) => ({
      share: toShareDto(row.share),
      item: toDriveItemDto(row.item),
    }));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get("shared-with-me/:folderId/items")
  async sharedFolderChildren(@CurrentUser() user: AuthUser, @Param("folderId") folderId: string) {
    const items = await this.sharesService.listSharedFolderChildren(user.userId, user.email, folderId);
    return toDriveItemDtoList(items);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  revoke(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.sharesService.revoke(user.userId, id);
  }

  // --- Public link endpoints: intentionally NOT behind JwtAuthGuard ---

  @Get("public/:token")
  async getPublic(@Param("token") token: string) {
    const { item, permission } = await this.sharesService.getPublicShareMetadata(token);
    return { item: toDriveItemDto(item), permission };
  }

  // @Get("public/:token/download")
  // async downloadPublic(@Param("token") token: string, @Res() res: Response) {
  //   const { stream, name, mimeType, size } = await this.sharesService.getPublicDownloadStream(token);
  //   res.setHeader("Content-Type", mimeType || "application/octet-stream");
  //   res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(name)}"`);
  //   if (size) res.setHeader("Content-Length", size.toString());
  //   stream.pipe(res);
  // }
}
