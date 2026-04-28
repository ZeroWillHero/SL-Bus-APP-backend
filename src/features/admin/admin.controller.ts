import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { BusOwnerService } from '../bus-owner/bus-owner.service';
import { BusOwnerDto } from '../bus-owner/dto/bus-owner.dto';
import { ResponseDTO } from '../../utils/common/dto/response.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Admin')
@ApiBearerAuth()
@Roles('Admin')
@Controller('api/v1/admin')
export class AdminController {
  constructor(private readonly busOwnerService: BusOwnerService) {}

  @Get('bus-owners')
  @ApiOperation({ summary: 'List all bus owners (Admin only)' })
  @ApiOkResponse({ type: [BusOwnerDto] })
  async listBusOwners(): Promise<ResponseDTO<BusOwnerDto[]>> {
    const result = await this.busOwnerService.findAll();
    return new ResponseDTO(true, 'Bus owners fetched successfully', result);
  }
}
