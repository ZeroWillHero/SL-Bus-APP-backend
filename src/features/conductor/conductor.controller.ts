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
import { CreateConductorDto } from './dto/create-conductor.dto';
import { UpdateConductorDto } from './dto/update-conductor.dto';
import {
  ApiBearerAuth,
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
export class ConductorController {
  constructor(
    private readonly conductorService: ConductorService,
    private readonly assignmentService: AssignmentService,
  ) {}

  @Post()
  async create(
    @Body() createConductorDto: CreateConductorDto,
  ): Promise<ResponseDTO<ConductorDTO>> {
    const result = await this.conductorService.create(createConductorDto);
    return new ResponseDTO<ConductorDTO>(
      true,
      'Conductor created successfully',
      result,
    );
  }

  @Get()
  async findAll(): Promise<ResponseDTO<ConductorDTO[]>> {
    const result = await this.conductorService.findAll();
    return new ResponseDTO<ConductorDTO[]>(
      true,
      'Conductors fetched successfully',
      result,
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ResponseDTO<ConductorDTO>> {
    const result = await this.conductorService.findOne(id);
    return new ResponseDTO<ConductorDTO>(
      true,
      'Conductor fetched successfully',
      result,
    );
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateConductorDto: UpdateConductorDto,
  ): Promise<ResponseDTO<ConductorDTO>> {
    const result = await this.conductorService.update(id, updateConductorDto);
    return new ResponseDTO<ConductorDTO>(
      true,
      'Conductor updated successfully',
      result,
    );
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ResponseDTO<null>> {
    await this.conductorService.remove(id);
    return new ResponseDTO<null>(true, 'Conductor deleted successfully', null);
  }

  // ─── Conductor self-service ───────────────────────────────────────────────

  @Get('me/buses')
  @ApiBearerAuth()
  @Roles('Conductor')
  @ApiOperation({
    summary: 'List buses assigned to the authenticated conductor',
  })
  @ApiOkResponse({ type: [BusDto] })
  async myBuses(@Req() req: Request): Promise<ResponseDTO<BusDto[]>> {
    const user = req.user as AuthenticatedUser;
    const conductor = await this.conductorService.findByUserId(user.userId);
    if(!conductor) {
      return new ResponseDTO<BusDto[]>(false, 'Conductor profile not found', []);
    }
    const result = await this.assignmentService.listBusesByConductor(
    conductor.id!,
    );
    return new ResponseDTO(true, 'Assigned buses fetched successfully', result);
  }
}
