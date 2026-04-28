import { ApiProperty } from '@nestjs/swagger';

export class SearchQueryDto {
  @ApiProperty({ example: 'Colombo' })
  origin!: string;

  @ApiProperty({ example: 'Kandy' })
  destination!: string;

  @ApiProperty({ example: '2026-05-01', description: 'YYYY-MM-DD' })
  date!: string;

  @ApiProperty({ example: 1, required: false, default: 1 })
  page?: number;

  @ApiProperty({ example: 20, required: false, default: 20 })
  limit?: number;

  @ApiProperty({
    example: 'time_asc',
    required: false,
    enum: ['time_asc', 'fare_asc', 'fare_desc'],
  })
  sort?: string;
}
