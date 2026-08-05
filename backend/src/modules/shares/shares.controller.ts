import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { toDriveItemDto, toDriveItemDtoList, toShareDto, toShareDtoList } from '../../common/mappers/response-mapper';
import { CreateShareDto } from './dto/create-share.dto';
import { SharesService } from './shares.service';

@ApiTags('shares')
@Controller('shares')
export class SharesController {
  constructor(private readonly shares: SharesService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateShareDto) {
    const result = await this.shares.create(user.userId, dto);
    return { share: toShareDto(result.share), token: result.token };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  async listMine(@CurrentUser() user: AuthUser) {
    return toShareDtoList(await this.shares.listMyShares(user.userId));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('shared-with-me')
  async sharedWithMe(@CurrentUser() user: AuthUser) {
    const rows = await this.shares.listSharedWithMe(user.userId, user.email);
    return rows.map((row) => ({ share: toShareDto(row.share), item: toDriveItemDto(row.item) }));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('shared-with-me/:folderId/items')
  async sharedFolderChildren(@CurrentUser() user: AuthUser, @Param('folderId') folderId: string) {
    return toDriveItemDtoList(await this.shares.listSharedFolderChildren(user.userId, user.email, folderId));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.shares.revoke(user.userId, id);
  }

  @Get('public/:token')
  async getPublic(@Param('token') token: string) {
    const result = await this.shares.getPublicShareMetadata(token);
    return { item: toDriveItemDto(result.item), permission: result.permission };
  }

  @Get('public/:token/download')
  downloadPublic(@Param('token') token: string) {
    return this.shares.getPublicDownloadUrl(token);
  }
}
