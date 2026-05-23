import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { BusOwnerService } from './bus-owner.service';
import { CreateBusOwnerDto } from './dto/create-bus-owner.dto';
import { UpdateBusOwnerDto } from './dto/update-bus-owner.dto';
import { BusOwnerDto } from './dto/bus-owner.dto';
import { ResponseDTO } from '../../utils/common/dto/response.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Bus Owner')
@Controller('api/v1/bus-owner')
export class BusOwnerController {
  constructor(private readonly busOwnerService: BusOwnerService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register as a bus owner' })
  @ApiCreatedResponse({ description: 'Bus owner registered successfully' })
  async register(
    @Body() dto: CreateBusOwnerDto,
  ): Promise<ResponseDTO<BusOwnerDto>> {
    const result = await this.busOwnerService.register(dto);
    return new ResponseDTO(true, 'Bus owner registered successfully', result);
  }

  @Roles('BusOwner')
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get own bus owner profile' })
  @ApiOkResponse({ type: BusOwnerDto })
  async getMe(@Req() req: Request): Promise<ResponseDTO<BusOwnerDto>> {
    const user = req.user as AuthenticatedUser;
    const result = await this.busOwnerService.findByUserId(user.userId, {
      includeBuses: true,
    });
    return new ResponseDTO(true, 'Profile fetched successfully', result);
  }

  @Roles('BusOwner')
  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update own bus owner profile' })
  @ApiOkResponse({ type: BusOwnerDto })
  async updateMe(
    @Req() req: Request,
    @Body() dto: UpdateBusOwnerDto,
  ): Promise<ResponseDTO<BusOwnerDto>> {
    const user = req.user as AuthenticatedUser;
    const profile = await this.busOwnerService.findByUserId(user.userId);
    const result = await this.busOwnerService.update(profile.id, dto);
    return new ResponseDTO(true, 'Profile updated successfully', result);
  }
}
