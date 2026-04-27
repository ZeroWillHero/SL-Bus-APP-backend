import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { UserService } from './user.service';
import { UserDTO } from './dto/user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@ApiTags('User')
@ApiBearerAuth()
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get own user profile' })
  @ApiOkResponse({ type: UserDTO })
  getMe(@Req() req: Request): Promise<UserDTO> {
    const user = req.user as AuthenticatedUser;
    return this.userService.getById(user.userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own user profile (email / phone)' })
  @ApiOkResponse({ type: UserDTO })
  updateMe(@Req() req: Request, @Body() body: UpdateUserDto): Promise<UserDTO> {
    const user = req.user as AuthenticatedUser;
    return this.userService.update(user.userId, body);
  }
}
