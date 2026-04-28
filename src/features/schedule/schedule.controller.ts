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
import {
  TripAvailabilityDto,
  TripAvailabilityService,
} from '../trip-availability/trip-availability.service';
import { ConductorService } from '../conductor/conductor.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleDto } from './dto/schedule.dto';
import { SetAvailabilityDto } from './dto/set-availability.dto';
import { ResponseDTO } from '../../utils/common/dto/response.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Schedules')
@ApiBearerAuth()
@Controller('api/v1/schedules')
export class ScheduleController {
  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly busOwnerService: BusOwnerService,
    private readonly tripAvailabilityService: TripAvailabilityService,
    private readonly conductorService: ConductorService,
  ) { }

  // ─── BusOwner endpoints ──────────────────────────────────────────────────────

  @Post()
  @Roles('BusOwner')
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
  @Roles('BusOwner')
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
  @Roles('BusOwner')
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
  @Roles('BusOwner')
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
  @Roles('BusOwner')
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

  // ─── Conductor endpoint ───────────────────────────────────────────────────────

  @Patch(':id/trips/:date/availability')
  @Roles('Conductor')
  @ApiOperation({
    summary: 'Toggle trip availability for a specific date (Conductor)',
  })
  @ApiOkResponse({ type: TripAvailabilityDto })
  async setAvailability(
    @Req() req: Request,
    @Param('id') scheduleId: string,
    @Param('date') date: string,
    @Body() dto: SetAvailabilityDto,
  ): Promise<ResponseDTO<TripAvailabilityDto>> {
    const user = req.user as AuthenticatedUser;
    const conductor = await this.conductorService.findByUserId(user.userId);
    const result = await this.tripAvailabilityService.toggle(
      scheduleId,
      date,
      dto.isAvailable,
      conductor.id!,
      user.userId,
    );
    return new ResponseDTO(true, 'Trip availability updated', result);
  }
}
