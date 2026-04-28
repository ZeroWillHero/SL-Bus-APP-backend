import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { BusService } from './bus.service';
import { CreateBusDto } from './dto/create-bus.dto';
import { UpdateBusDto } from './dto/update-bus.dto';
import { BusDto } from './dto/bus.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { BusDocumentDto } from './dto/bus-document.dto';
import { ResponseDTO } from '../../utils/common/dto/response.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApprovalStatus } from './enums/approval-status.enum';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { BusOwnerService } from '../bus-owner/bus-owner.service';

@ApiTags('Bus')
@ApiBearerAuth()
@Roles('BusOwner')
@Controller('api/v1/buses')
export class BusController {
  constructor(
    private readonly busService: BusService,
    private readonly busOwnerService: BusOwnerService,
  ) {}

  @Post()
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
  @ApiOperation({ summary: 'List own buses (BusOwner)' })
  @ApiQuery({ name: 'status', enum: ApprovalStatus, required: false })
  @ApiOkResponse({ type: [BusDto] })
  async findAll(
    @Req() req: Request,
    @Query('status') status?: ApprovalStatus,
  ): Promise<ResponseDTO<BusDto[]>> {
    const user = req.user as AuthenticatedUser;
    const owner = await this.busOwnerService.findByUserId(user.userId);
    const result = await this.busService.findAllByOwner(owner.id, status);
    return new ResponseDTO(true, 'Buses fetched successfully', result);
  }

  @Get(':id')
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
}
