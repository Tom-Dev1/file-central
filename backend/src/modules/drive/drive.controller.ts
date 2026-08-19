import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "../../common/decorators/current-user.decorator";
import { DriveService } from "./drive.service";
import { RenameDto } from "./dto/rename.dto";
import { MoveDto } from "./dto/move.dto";
import { BulkTrashDto } from "./dto/bulk-trash.dto";
import { BulkMoveDto } from "./dto/bulk-move.dto";
import { PaginationQueryDto } from "./dto/pagination-query.dto";
import { SearchQueryDto } from "./dto/search-query.dto";
import { toDriveItemDto, toDriveItemDtoList } from "../../common/mappers/response-mapper";
import { DriveDriveItemsDto } from "./dto/drive-item-query.dto";
import { DriveCollectionQueryDto } from "./dto/drive-collection-query.dto";
import { SetStarredDto } from "./dto/set-starred.dto";
import {
  DriveItemSortBy,
  DriveItemSortDirection,
} from "../drive-items/domain/enums/drive-item.enum";

@ApiTags("drive")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("drive")
export class DriveController {
  constructor(private driveService: DriveService) { }

  @Get("recent")
  async recent(
    @CurrentUser() user: AuthUser,
    @Query() query: DriveCollectionQueryDto,
  ) {
    const result = await this.driveService.recent(
      user.userId,
      query.cursor,
      query.limit ?? 50,
      query.sort ?? DriveItemSortBy.MODIFIED,
      query.direction ?? DriveItemSortDirection.DESC,
    );
    return { ...result, items: toDriveItemDtoList(result.items) };
  }

  @Get("starred")
  async starred(
    @CurrentUser() user: AuthUser,
    @Query() query: DriveCollectionQueryDto,
  ) {
    const result = await this.driveService.starred(
      user.userId,
      query.cursor,
      query.limit ?? 50,
      query.sort ?? DriveItemSortBy.NAME,
      query.direction ?? DriveItemSortDirection.ASC,
    );
    return { ...result, items: toDriveItemDtoList(result.items) };
  }

  // NOTE: /drive/search must be declared before /drive/:id-style routes
  // in the same controller to avoid Express matching "search" as an :id.
  @Get("search")
  async search(@CurrentUser() user: AuthUser, @Query() query: SearchQueryDto) {
    const result = await this.driveService.search(
      user.userId,
      query.q || "",
      query.type,
      query.cursor,
      query.limit ?? 50
    );
    return { ...result, items: toDriveItemDtoList(result.items) };
  }

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query() query: DriveDriveItemsDto
  ) {
    const result = await this.driveService.list(
      user.userId,
      query.parentId ?? null,
      query.cursor,
      query.limit ?? 50,
      query.sort ?? DriveItemSortBy.NAME,
      query.direction ?? DriveItemSortDirection.ASC,
    );
    return { ...result, items: toDriveItemDtoList(result.items) };
  }
  @Get(":id/ancestors")
  async getAncestors(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const chain = await this.driveService.getAncestors(user.userId, user.email, id);
    return toDriveItemDtoList(chain);
  }

  @Get(":id")
  async getById(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const item = await this.driveService.getById(user.userId, user.email, id);
    return toDriveItemDto(item);
  }

  @Patch("bulk/move")
  moveMany(@CurrentUser() user: AuthUser, @Body() dto: BulkMoveDto) {
    return this.driveService.moveMany(user.userId, user.email, dto);
  }

  @Patch(":id/rename")
  async rename(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: RenameDto) {
    const item = await this.driveService.rename(user.userId, user.email, id, dto);
    return toDriveItemDto(item);
  }

  @Patch(":id/move")
  async move(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: MoveDto) {
    const item = await this.driveService.move(user.userId, user.email, id, dto);
    return toDriveItemDto(item);
  }

  @Patch(":id/starred")
  async setStarred(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: SetStarredDto,
  ) {
    const item = await this.driveService.setStarred(user.userId, id, dto.starred);
    return toDriveItemDto(item);
  }

  @Delete("bulk")
  removeMany(@CurrentUser() user: AuthUser, @Body() dto: BulkTrashDto) {
    return this.driveService.removeMany(user.userId, user.email, dto.itemIds);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.driveService.remove(user.userId, user.email, id);
  }
}
