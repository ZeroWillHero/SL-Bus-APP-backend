import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { BusOwnerService } from '../bus-owner/bus-owner.service';
import { BusOwnerDto } from '../bus-owner/dto/bus-owner.dto';
import { BusService } from '../bus/bus.service';
import { BusDto } from '../bus/dto/bus.dto';
import { BusDocumentDto } from '../bus/dto/bus-document.dto';
import { RejectBusDto } from '../bus/dto/reject-bus.dto';
import { ResponseDTO } from '../../utils/common/dto/response.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApprovalStatus } from '../bus/enums/approval-status.enum';

@ApiTags('Admin')
@ApiBearerAuth()
@Roles('Admin')
@Controller('api/v1/admin')
export class AdminController {
  constructor(
    private readonly busOwnerService: BusOwnerService,
    private readonly busService: BusService,
  ) {}

  // ─── Bus Owner ────────────────────────────────────────────────────────────────

  @Get('bus-owners')
  @ApiOperation({ summary: 'List all bus owners' })
  @ApiOkResponse({ type: [BusOwnerDto] })
  async listBusOwners(): Promise<ResponseDTO<BusOwnerDto[]>> {
    const result = await this.busOwnerService.findAll();
    return new ResponseDTO(true, 'Bus owners fetched successfully', result);
  }

  // ─── Bus Management ───────────────────────────────────────────────────────────

  @Get('buses')
  @ApiOperation({
    summary: 'List all buses, optionally filtered by approval status',
  })
  @ApiQuery({ name: 'status', enum: ApprovalStatus, required: false })
  @ApiOkResponse({ type: [BusDto] })
  async listBuses(
    @Query('status') status?: ApprovalStatus,
  ): Promise<ResponseDTO<BusDto[]>> {
    const result = await this.busService.findAll(status);
    return new ResponseDTO(true, 'Buses fetched successfully', result);
  }

  @Get('buses/:id')
  @ApiOperation({ summary: 'Get bus detail' })
  @ApiOkResponse({ type: BusDto })
  async getBus(@Param('id') id: string): Promise<ResponseDTO<BusDto>> {
    const result = await this.busService.findOneAdmin(id);
    return new ResponseDTO(true, 'Bus fetched successfully', result);
  }

  @Get('buses/:id/documents')
  @ApiOperation({ summary: 'List submitted documents for a bus' })
  @ApiOkResponse({ type: [BusDocumentDto] })
  async listBusDocuments(
    @Param('id') id: string,
  ): Promise<ResponseDTO<BusDocumentDto[]>> {
    const result = await this.busService.listDocumentsAdmin(id);
    return new ResponseDTO(true, 'Documents fetched successfully', result);
  }

  @Post('buses/:id/approve')
  @ApiOperation({ summary: 'Approve a bus' })
  @ApiOkResponse({ type: BusDto })
  async approveBus(@Param('id') id: string): Promise<ResponseDTO<BusDto>> {
    const result = await this.busService.approve(id);
    return new ResponseDTO(true, 'Bus approved successfully', result);
  }

  @Post('buses/:id/reject')
  @ApiOperation({ summary: 'Reject a bus with a mandatory reason' })
  @ApiOkResponse({ type: BusDto })
  async rejectBus(
    @Param('id') id: string,
    @Body() dto: RejectBusDto,
  ): Promise<ResponseDTO<BusDto>> {
    const result = await this.busService.reject(id, dto.reason);
    return new ResponseDTO(true, 'Bus rejected', result);
  }
}
