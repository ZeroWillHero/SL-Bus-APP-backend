import { Body, Controller, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { AuthRequestDTO } from './dto/authRequest.dto';
import { AuthResponseDTO } from './dto/auth.response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login with email/phone and password',
    description:
      'Authenticates a user and returns an access token. A refresh token is also set as an httpOnly cookie.',
  })
  @ApiBody({ type: AuthRequestDTO })
  @ApiOkResponse({
    description: 'Login successful',
    type: AuthResponseDTO,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid username or password' })
  async login(
    @Body() body: AuthRequestDTO,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.login(body, res);
  }
}
