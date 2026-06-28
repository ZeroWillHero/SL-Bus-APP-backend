import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { UserDTO } from './dto/user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { VerifyDto } from './dto/verify.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('User')
@ApiBearerAuth()
@Controller('api/v1/user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get own user profile (all authenticated roles)' })
  @ApiOkResponse({ type: UserDTO })
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<UserDTO> {
    return this.userService.getById(user.userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own user profile (email / phone)' })
  @ApiOkResponse({ type: UserDTO })
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateUserDto,
  ): Promise<UserDTO> {
    return this.userService.update(user.userId, body);
  }

  @Public()
  @Post('verify')
  @ApiOperation({ summary: 'Verify user account with OTP' })
  @ApiOkResponse()
  verifyUser(@Body() body: VerifyDto): Promise<void> {
    return this.userService.verifyUser(body.phone, body.otp);
  }
}
