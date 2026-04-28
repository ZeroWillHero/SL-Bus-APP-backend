import { ApiProperty } from '@nestjs/swagger';

export class SetAvailabilityDto {
  @ApiProperty({ example: false, description: 'Set false to cancel this trip' })
  isAvailable!: boolean;
}
