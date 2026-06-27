import { ApiProperty } from '@nestjs/swagger';

export class PaginationDTO {
  @ApiProperty({
    required: false,
    example: 1,
    description: 'Page number (1-based)',
  })
  page?: number;

  @ApiProperty({
    required: false,
    example: 20,
    description: 'Items per page (max 100)',
  })
  limit?: number;

  @ApiProperty({ required: false, example: 'createdAt' })
  sortBy?: string;

  @ApiProperty({ required: false, enum: ['ASC', 'DESC'], example: 'DESC' })
  sortOrder?: 'ASC' | 'DESC';
}

export function parsePage(raw: unknown, def = 1): number {
  return Math.max(1, Number(raw) || def);
}

export function parseLimit(raw: unknown, def = 20): number {
  return Math.min(100, Math.max(1, Number(raw) || def));
}
