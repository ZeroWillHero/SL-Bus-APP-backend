import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
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
import { VerifyDto } from './dto/verify.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('User')
// @ApiBearerAuth()
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

  @Public()
  @Post('verify')
  @ApiOperation({ summary: 'Verify user account' })
  @ApiOkResponse({ type: UserDTO })
  verifyUser(@Body() body: VerifyDto): Promise<void> {
    return this.userService.verifyUser(body.phone, body.otp);
  }
}
