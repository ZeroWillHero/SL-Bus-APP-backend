import { ApiProperty } from '@nestjs/swagger';

export class PageResponseDTO<T> {
  @ApiProperty({ isArray: true })
  items!: T[];

  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 5 })
  pages!: number;

  @ApiProperty({ example: 2, required: false })
  nextPage?: number;

  @ApiProperty({ required: false })
  prevPage?: number;

  constructor(items: T[], total: number, page: number, limit: number) {
    this.items = items;
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.pages = Math.ceil(total / limit) || 1;
    this.nextPage = page * limit < total ? page + 1 : undefined;
    this.prevPage = page > 1 ? page - 1 : undefined;
  }
}
