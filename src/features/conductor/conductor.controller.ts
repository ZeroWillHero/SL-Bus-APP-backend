import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ConductorService } from './conductor.service';
import { AssignmentService } from '../bus/assignment.service';
import { BusOwnerService } from '../bus-owner/bus-owner.service';
import { CreateConductorDto } from './dto/create-conductor.dto';
import { UpdateConductorDto } from './dto/update-conductor.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ResponseDTO } from '../../utils/common/dto/response.dto';
import { ConductorDTO } from './dto/conductor.dto';
import { BusDto } from '../bus/dto/bus.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@Controller('api/v1/conductor')
@ApiTags('Conductor')
@ApiBearerAuth()
export class ConductorController {
  constructor(
    private readonly conductorService: ConductorService,
    private readonly assignmentService: AssignmentService,
    private readonly busOwnerService: BusOwnerService,
  ) {}

  @Post()
  @Roles('BusOwner')
  @ApiOperation({ summary: 'Register a conductor under the authenticated bus owner' })
  @ApiCreatedResponse({ type: ConductorDTO })
  async create(
    @Req() req: Request,
    @Body() createConductorDto: CreateConductorDto,
  ): Promise<ResponseDTO<ConductorDTO>> {
    const user = req.user as AuthenticatedUser;
    const owner = await this.busOwnerService.findByUserId(user.userId);
    const result = await this.conductorService.create(createConductorDto, owner.id);
    return new ResponseDTO<ConductorDTO>(true, 'Conductor created successfully', result);
  }

  @Get()
  @Roles('Admin', 'BusOwner')
  @ApiOperation({ summary: 'List conductors — Admin sees all, BusOwner sees own' })
  @ApiOkResponse({ type: [ConductorDTO] })
  async findAll(@Req() req: Request): Promise<ResponseDTO<ConductorDTO[]>> {
    const user = req.user as AuthenticatedUser;
    if (user.roles.includes('Admin')) {
      const result = await this.conductorService.findAll();
      return new ResponseDTO<ConductorDTO[]>(true, 'Conductors fetched successfully', result);
    }
    const owner = await this.busOwnerService.findByUserId(user.userId);
    const result = await this.conductorService.findAllByOwner(owner.id);
    return new ResponseDTO<ConductorDTO[]>(true, 'Conductors fetched successfully', result);
  }

  @Get(':id')
  @Roles('Admin', 'BusOwner')
  @ApiOperation({ summary: 'Get conductor by ID' })
  @ApiOkResponse({ type: ConductorDTO })
  async findOne(@Param('id') id: string): Promise<ResponseDTO<ConductorDTO>> {
    const result = await this.conductorService.findOne(id);
    return new ResponseDTO<ConductorDTO>(true, 'Conductor fetched successfully', result);
  }

  @Patch(':id')
  @Roles('Admin', 'BusOwner')
  @ApiOperation({ summary: 'Update conductor' })
  @ApiOkResponse({ type: ConductorDTO })
  async update(
    @Param('id') id: string,
    @Body() updateConductorDto: UpdateConductorDto,
  ): Promise<ResponseDTO<ConductorDTO>> {
    const result = await this.conductorService.update(id, updateConductorDto);
    return new ResponseDTO<ConductorDTO>(true, 'Conductor updated successfully', result);
  }

  @Delete(':id')
  @Roles('Admin', 'BusOwner')
  @ApiOperation({ summary: 'Delete conductor' })
  async remove(@Param('id') id: string): Promise<ResponseDTO<null>> {
    await this.conductorService.remove(id);
    return new ResponseDTO<null>(true, 'Conductor deleted successfully', null);
  }

  // ─── Conductor self-service ───────────────────────────────────────────────

  @Get('me/buses')
  @Roles('Conductor')
  @ApiOperation({ summary: 'List buses assigned to the authenticated conductor' })
  @ApiOkResponse({ type: [BusDto] })
  async myBuses(@Req() req: Request): Promise<ResponseDTO<BusDto[]>> {
    const user = req.user as AuthenticatedUser;
    const conductor = await this.conductorService.findByUserId(user.userId);
    const result = await this.assignmentService.listBusesByConductor(conductor.id!);
    return new ResponseDTO(true, 'Assigned buses fetched successfully', result);
  }
}
