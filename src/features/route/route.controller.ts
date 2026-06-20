import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RouteService } from './route.service';
import { BusOwnerService } from '../bus-owner/bus-owner.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { RouteDto } from './dto/route.dto';
import { RouteStopDto } from './dto/route-stop.dto';
import { CreateRouteStopDto } from './dto/create-route-stop.dto';
import { UpdateRouteStopDto } from './dto/update-route-stop.dto';
import { ResponseDTO } from '../../utils/common/dto/response.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Routes')
@ApiBearerAuth()
@Roles('BusOwner')
@Controller('api/v1/routes')
export class RouteController {
  constructor(
    private readonly routeService: RouteService,
    private readonly busOwnerService: BusOwnerService,
  ) {}

  // ─── Route CRUD ──────────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a route (BusOwner)' })
  @ApiCreatedResponse({ type: RouteDto })
  async create(
    @Req() req: Request,
    @Body() dto: CreateRouteDto,
  ): Promise<ResponseDTO<RouteDto>> {
    const user = req.user as AuthenticatedUser;
    const owner = await this.busOwnerService.findByUserId(user.userId);
    const result = await this.routeService.create(owner.id, dto);
    return new ResponseDTO(true, 'Route created successfully', result);
  }

  @Get()
  @ApiOperation({ summary: 'List own routes (BusOwner)' })
  @ApiOkResponse({ type: [RouteDto] })
  async findAll(@Req() req: Request): Promise<ResponseDTO<RouteDto[]>> {
    const user = req.user as AuthenticatedUser;
    const owner = await this.busOwnerService.findByUserId(user.userId);
    const result = await this.routeService.findAllByOwner(owner.id);
    return new ResponseDTO(true, 'Routes fetched successfully', result);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get route by ID (BusOwner)' })
  @ApiOkResponse({ type: RouteDto })
  async findOne(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<ResponseDTO<RouteDto>> {
    const user = req.user as AuthenticatedUser;
    const owner = await this.busOwnerService.findByUserId(user.userId);
    const result = await this.routeService.findOne(id, owner.id);
    return new ResponseDTO(true, 'Route fetched successfully', result);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a route (BusOwner)' })
  @ApiOkResponse({ type: RouteDto })
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateRouteDto,
  ): Promise<ResponseDTO<RouteDto>> {
    const user = req.user as AuthenticatedUser;
    const owner = await this.busOwnerService.findByUserId(user.userId);
    const result = await this.routeService.update(id, owner.id, dto);
    return new ResponseDTO(true, 'Route updated successfully', result);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a route (BusOwner)' })
  @ApiOkResponse({ type: RouteDto })
  async deactivate(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<ResponseDTO<RouteDto>> {
    const user = req.user as AuthenticatedUser;
    const owner = await this.busOwnerService.findByUserId(user.userId);
    const result = await this.routeService.deactivate(id, owner.id);
    return new ResponseDTO(true, 'Route deactivated successfully', result);
  }

  // ─── Stop management ─────────────────────────────────────────────────────────

  @Post(':id/stops')
  @ApiOperation({ summary: 'Add a stop to a route (BusOwner)' })
  @ApiCreatedResponse({ type: RouteStopDto })
  async addStop(
    @Req() req: Request,
    @Param('id') routeId: string,
    @Body() dto: CreateRouteStopDto,
  ): Promise<ResponseDTO<RouteStopDto>> {
    const user = req.user as AuthenticatedUser;
    const owner = await this.busOwnerService.findByUserId(user.userId);
    const result = await this.routeService.addStop(routeId, owner.id, dto);
    return new ResponseDTO(true, 'Stop added successfully', result);
  }

  @Get(':id/stops')
  @ApiOperation({ summary: 'List stops for a route (BusOwner)' })
  @ApiOkResponse({ type: [RouteStopDto] })
  async getStops(
    @Req() req: Request,
    @Param('id') routeId: string,
  ): Promise<ResponseDTO<RouteStopDto[]>> {
    const user = req.user as AuthenticatedUser;
    const owner = await this.busOwnerService.findByUserId(user.userId);
    const result = await this.routeService.getStops(routeId, owner.id);
    return new ResponseDTO(true, 'Stops fetched successfully', result);
  }

  @Patch(':id/stops/:stopId')
  @ApiOperation({ summary: 'Update a stop (BusOwner)' })
  @ApiOkResponse({ type: RouteStopDto })
  async updateStop(
    @Req() req: Request,
    @Param('id') routeId: string,
    @Param('stopId') stopId: string,
    @Body() dto: UpdateRouteStopDto,
  ): Promise<ResponseDTO<RouteStopDto>> {
    const user = req.user as AuthenticatedUser;
    const owner = await this.busOwnerService.findByUserId(user.userId);
    const result = await this.routeService.updateStop(routeId, stopId, owner.id, dto);
    return new ResponseDTO(true, 'Stop updated successfully', result);
  }

  @Delete(':id/stops/:stopId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a stop from a route (BusOwner)' })
  @ApiNoContentResponse()
  async removeStop(
    @Req() req: Request,
    @Param('id') routeId: string,
    @Param('stopId') stopId: string,
  ): Promise<ResponseDTO<null>> {
    const user = req.user as AuthenticatedUser;
    const owner = await this.busOwnerService.findByUserId(user.userId);
    await this.routeService.removeStop(routeId, stopId, owner.id);
    return new ResponseDTO(true, 'Stop removed successfully', null);
  }
}
