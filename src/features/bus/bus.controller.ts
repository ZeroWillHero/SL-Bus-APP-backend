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
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { BusService } from './bus.service';
import { AssignmentService } from './assignment.service';
import { CreateBusDto } from './dto/create-bus.dto';
import { UpdateBusDto } from './dto/update-bus.dto';
import { BusDto } from './dto/bus.dto';
import { BusFilterDto } from './dto/bus-filter.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { BusDocumentDto } from './dto/bus-document.dto';
import { BusAssignmentDto } from './dto/bus-assignment.dto';
import { RouteDto } from '../route/dto/route.dto';
import { RouteService } from '../route/route.service';
import { ConductorService } from '../conductor/conductor.service';
import { ResponseDTO } from '../../utils/common/dto/response.dto';
import { PageResponseDTO } from '../../utils/common/dto/pageResponse.dto';
import { parsePage, parseLimit } from '../../utils/common/dto/pagination.dto';
import { paginatedSchema } from '../../utils/common/swagger/paginated-schema';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApprovalStatus } from './enums/approval-status.enum';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { BusOwnerService } from '../bus-owner/bus-owner.service';

@ApiTags('Bus')
@ApiBearerAuth()
@ApiExtraModels(BusDto)
@Controller('api/v1/buses')
export class BusController {
  constructor(
    private readonly busService: BusService,
    private readonly busOwnerService: BusOwnerService,
    private readonly assignmentService: AssignmentService,
    private readonly routeService: RouteService,
    private readonly conductorService: ConductorService,
  ) {}

  @Post()
  @Roles('BusOwner')
  @ApiOperation({ summary: 'Register a new bus (BusOwner)' })
  @ApiCreatedResponse({ type: BusDto })
  async create(
    @Req() req: Request,
    @Body() dto: CreateBusDto,
  ): Promise<ResponseDTO<BusDto>> {
    const user = req.user as AuthenticatedUser;
    const owner = await this.busOwnerService.findByUserId(user.userId);
    const result = await this.busService.create(owner.id, dto);
    return new ResponseDTO(true, 'Bus registered successfully', result);
  }

  @Get()
  @Roles('Admin', 'BusOwner', 'Conductor', 'Customer')
  @ApiOperation({
    summary:
      'List buses (paginated) — Admin/Customer see all (Customer: APPROVED only), BusOwner sees own, Conductor sees assigned',
  })
  @ApiOkResponse({ schema: paginatedSchema(BusDto) })
  async findAll(
    @Req() req: Request,
    @Query() filters: BusFilterDto,
  ): Promise<ResponseDTO<PageResponseDTO<BusDto>>> {
    const user = req.user as AuthenticatedUser;
    const page = parsePage(filters.page);
    const limit = parseLimit(filters.limit);

    if (user.roles.includes('Admin')) {
      const { items, total } = await this.busService.findAll(filters);
      return new ResponseDTO(
        true,
        'Buses fetched successfully',
        new PageResponseDTO(items, total, page, limit),
      );
    }

    if (user.roles.includes('BusOwner')) {
      const owner = await this.busOwnerService.findByUserId(user.userId);
      const { items, total } = await this.busService.findAllByOwner(
        owner.id,
        filters,
      );
      return new ResponseDTO(
        true,
        'Buses fetched successfully',
        new PageResponseDTO(items, total, page, limit),
      );
    }

    if (user.roles.includes('Customer')) {
      // Customers see only approved buses
      const { items, total } = await this.busService.findAll({
        ...filters,
        status: ApprovalStatus.APPROVED,
      });
      return new ResponseDTO(
        true,
        'Buses fetched successfully',
        new PageResponseDTO(items, total, page, limit),
      );
    }

    // Conductor — returns assigned buses (bounded set, no pagination needed)
    const conductor = await this.conductorService.findByUserId(user.userId);
    const buses = await this.assignmentService.listBusesByConductor(
      conductor.id!,
    );
    return new ResponseDTO(
      true,
      'Buses fetched successfully',
      new PageResponseDTO(buses, buses.length, 1, buses.length || 1),
    );
  }

  @Get(':id')
  @Roles('BusOwner')
  @ApiOperation({ summary: 'Get own bus by ID (BusOwner)' })
  @ApiOkResponse({ type: BusDto })
  async findOne(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<ResponseDTO<BusDto>> {
    const user = req.user as AuthenticatedUser;
    const owner = await this.busOwnerService.findByUserId(user.userId);
    const result = await this.busService.findOneByOwner(id, owner.id);
    return new ResponseDTO(true, 'Bus fetched successfully', result);
  }

  @Patch(':id')
  @Roles('BusOwner')
  @ApiOperation({ summary: 'Update bus (only PENDING or REJECTED)' })
  @ApiOkResponse({ type: BusDto })
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateBusDto,
  ): Promise<ResponseDTO<BusDto>> {
    const user = req.user as AuthenticatedUser;
    const owner = await this.busOwnerService.findByUserId(user.userId);
    const result = await this.busService.update(id, owner.id, dto);
    return new ResponseDTO(true, 'Bus updated successfully', result);
  }

  // ─── Documents ───────────────────────────────────────────────────────────────

  @Post(':id/documents')
  @Roles('BusOwner')
  @ApiOperation({ summary: 'Upload a bus document (base64)' })
  @ApiCreatedResponse({ type: BusDocumentDto })
  async uploadDocument(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UploadDocumentDto,
  ): Promise<ResponseDTO<BusDocumentDto>> {
    const user = req.user as AuthenticatedUser;
    const owner = await this.busOwnerService.findByUserId(user.userId);
    const result = await this.busService.uploadDocument(id, owner.id, dto);
    return new ResponseDTO(true, 'Document uploaded successfully', result);
  }

  @Get(':id/documents')
  @Roles('BusOwner')
  @ApiOperation({ summary: 'List bus documents (metadata only)' })
  @ApiOkResponse({ type: [BusDocumentDto] })
  async listDocuments(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<ResponseDTO<BusDocumentDto[]>> {
    const user = req.user as AuthenticatedUser;
    const owner = await this.busOwnerService.findByUserId(user.userId);
    const result = await this.busService.listDocuments(id, owner.id);
    return new ResponseDTO(true, 'Documents fetched successfully', result);
  }

  @Get(':id/documents/:docId')
  @Roles('BusOwner')
  @ApiOperation({ summary: 'Get single document including fileData' })
  @ApiOkResponse({ type: BusDocumentDto })
  async getDocument(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('docId') docId: string,
  ): Promise<ResponseDTO<BusDocumentDto>> {
    const user = req.user as AuthenticatedUser;
    const owner = await this.busOwnerService.findByUserId(user.userId);
    const result = await this.busService.getDocument(id, owner.id, docId);
    return new ResponseDTO(true, 'Document fetched successfully', result);
  }

  // ─── Route Assignments ────────────────────────────────────────────────────────

  @Get(':id/routes')
  @Roles('BusOwner')
  @ApiOperation({ summary: 'List routes assigned to a bus (BusOwner)' })
  @ApiOkResponse({ type: [RouteDto] })
  async listRoutes(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<ResponseDTO<RouteDto[]>> {
    const user = req.user as AuthenticatedUser;
    const owner = await this.busOwnerService.findByUserId(user.userId);
    const result = await this.routeService.findAllByBus(id, owner.id);
    return new ResponseDTO(true, 'Routes fetched successfully', result);
  }

  @Post(':id/routes/:routeId')
  @Roles('BusOwner')
  @ApiOperation({ summary: 'Assign a route to a bus (BusOwner)' })
  @ApiOkResponse({ type: RouteDto })
  async assignRoute(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('routeId') routeId: string,
  ): Promise<ResponseDTO<RouteDto>> {
    const user = req.user as AuthenticatedUser;
    const owner = await this.busOwnerService.findByUserId(user.userId);
    const result = await this.routeService.assignToBus(routeId, id, owner.id);
    return new ResponseDTO(true, 'Route assigned to bus successfully', result);
  }

  @Delete(':id/routes/:routeId')
  @Roles('BusOwner')
  @ApiOperation({ summary: 'Unassign a route from a bus (BusOwner)' })
  @ApiOkResponse({ type: RouteDto })
  async unassignRoute(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('routeId') routeId: string,
  ): Promise<ResponseDTO<RouteDto>> {
    const user = req.user as AuthenticatedUser;
    const owner = await this.busOwnerService.findByUserId(user.userId);
    const result = await this.routeService.unassignFromBus(
      routeId,
      id,
      owner.id,
    );
    return new ResponseDTO(
      true,
      'Route unassigned from bus successfully',
      result,
    );
  }

  // ─── Conductor Assignments ───────────────────────────────────────────────────

  @Get(':id/conductors')
  @Roles('BusOwner')
  @ApiOperation({
    summary: 'List active conductors assigned to a bus (BusOwner)',
  })
  @ApiOkResponse({ type: [BusAssignmentDto] })
  async listConductors(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<ResponseDTO<BusAssignmentDto[]>> {
    const user = req.user as AuthenticatedUser;
    const owner = await this.busOwnerService.findByUserId(user.userId);
    const result = await this.assignmentService.listConductors(id, owner.id);
    return new ResponseDTO(true, 'Conductors fetched successfully', result);
  }

  @Post(':id/conductors/:conductorId')
  @Roles('BusOwner')
  @ApiOperation({ summary: 'Assign a conductor to a bus (BusOwner)' })
  @ApiCreatedResponse({ type: BusAssignmentDto })
  async assignConductor(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('conductorId') conductorId: string,
  ): Promise<ResponseDTO<BusAssignmentDto>> {
    const user = req.user as AuthenticatedUser;
    const owner = await this.busOwnerService.findByUserId(user.userId);
    const result = await this.assignmentService.assign(
      id,
      conductorId,
      owner.id,
    );
    return new ResponseDTO(true, 'Conductor assigned successfully', result);
  }

  @Delete(':id/conductors/:conductorId')
  @Roles('BusOwner')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unassign a conductor from a bus (BusOwner)' })
  @ApiNoContentResponse({ description: 'Conductor unassigned' })
  async unassignConductor(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('conductorId') conductorId: string,
  ): Promise<void> {
    const user = req.user as AuthenticatedUser;
    const owner = await this.busOwnerService.findByUserId(user.userId);
    await this.assignmentService.unassign(id, conductorId, owner.id);
  }
}
