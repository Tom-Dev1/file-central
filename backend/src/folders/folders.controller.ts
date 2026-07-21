import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { FoldersService } from './folders.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { toDriveItemDto } from '../common/mappers/response-mapper';

@ApiTags('folders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('folders')
export class FoldersController {
  constructor(private foldersService: FoldersService) {}

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateFolderDto) {
    const folder = await this.foldersService.create(user.userId, dto);
    return toDriveItemDto(folder);
  }
}
