import { ApiProperty } from '@nestjs/swagger';

export class PaginatedResponseDto<T> {
  @ApiProperty({ isArray: true })
  items: T[];

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  totalPages: number;

  constructor(items: T[], page: number, limit: number, total: number) {
    this.items = items;
    this.page = page;
    this.limit = limit;
    this.total = total;
    this.totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  }
}
