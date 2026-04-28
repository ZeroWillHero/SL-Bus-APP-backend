import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ScheduleService } from './schedule.service';
import { BusOwnerService } from '../bus-owner/bus-owner.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleDto } from './dto/schedule.dto';
import { ResponseDTO } from '../../utils/common/dto/response.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Schedules')
@ApiBearerAuth()
@Roles('BusOwner')
@Controller('api/v1/schedules')
export class ScheduleController {
  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly busOwnerService: BusOwnerService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a schedule for an approved bus (BusOwner)' })
  @ApiCreatedResponse({ type: ScheduleDto })
  async create(
    @Req() req: Request,
    @Body() dto: CreateScheduleDto,
  ): Promise<ResponseDTO<ScheduleDto>> {
    const user = req.user as AuthenticatedUser;
    const owner = await this.busOwnerService.findByUserId(user.userId);
    const result = await this.scheduleService.create(owner.id, dto);
    return new ResponseDTO(true, 'Schedule created successfully', result);
  }

  @Get()
  @ApiOperation({
    summary: 'List own schedules with optional filters (BusOwner)',
  })
  @ApiQuery({ name: 'busId', required: false })
  @ApiQuery({ name: 'routeId', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiOkResponse({ type: [ScheduleDto] })
  async findAll(
    @Req() req: Request,
    @Query('busId') busId?: string,
    @Query('routeId') routeId?: string,
    @Query('isActive') isActive?: string,
  ): Promise<ResponseDTO<ScheduleDto[]>> {
    const user = req.user as AuthenticatedUser;
    const owner = await this.busOwnerService.findByUserId(user.userId);
    const activeFilter =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    const result = await this.scheduleService.findAll(owner.id, {
      busId,
      routeId,
      isActive: activeFilter,
    });
    return new ResponseDTO(true, 'Schedules fetched successfully', result);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get schedule by ID (BusOwner)' })
  @ApiOkResponse({ type: ScheduleDto })
  async findOne(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<ResponseDTO<ScheduleDto>> {
    const user = req.user as AuthenticatedUser;
    const owner = await this.busOwnerService.findByUserId(user.userId);
    const result = await this.scheduleService.findOne(id, owner.id);
    return new ResponseDTO(true, 'Schedule fetched successfully', result);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update schedule fare/time/days (BusOwner)' })
  @ApiOkResponse({ type: ScheduleDto })
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
  ): Promise<ResponseDTO<ScheduleDto>> {
    const user = req.user as AuthenticatedUser;
    const owner = await this.busOwnerService.findByUserId(user.userId);
    const result = await this.scheduleService.update(id, owner.id, dto);
    return new ResponseDTO(true, 'Schedule updated successfully', result);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a schedule (BusOwner)' })
  @ApiOkResponse({ type: ScheduleDto })
  async deactivate(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<ResponseDTO<ScheduleDto>> {
    const user = req.user as AuthenticatedUser;
    const owner = await this.busOwnerService.findByUserId(user.userId);
    const result = await this.scheduleService.deactivate(id, owner.id);
    return new ResponseDTO(true, 'Schedule deactivated successfully', result);
  }
}
