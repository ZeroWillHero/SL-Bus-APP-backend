import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ConductorService } from './conductor.service';
import { CreateConductorDto } from './dto/create-conductor.dto';
import { UpdateConductorDto } from './dto/update-conductor.dto';
import { ApiTags } from '@nestjs/swagger';
import { ResponseDTO } from '../../utils/common/dto/response.dto';
import { ConductorDTO } from './dto/conductor.dto';

@Controller('api/v1/conductor')
@ApiTags('Conductor')
export class ConductorController {
  constructor(private readonly conductorService: ConductorService) {}

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
}
