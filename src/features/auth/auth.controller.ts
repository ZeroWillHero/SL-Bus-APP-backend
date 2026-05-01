import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuthRequestDTO } from './dto/authRequest.dto';
import { AuthResponseDTO } from './dto/auth.response.dto';
import { Public } from '../../common/decorators/public.decorator';
import { AuthRegisterDTO } from './dto/auth.register.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Login with email/phone and password' })
  @ApiBody({ type: AuthRequestDTO })
  @ApiOkResponse({ description: 'Login successful', type: AuthResponseDTO })
  @ApiUnauthorizedResponse({ description: 'Invalid username or password' })
  async login(
    @Body() body: AuthRequestDTO,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.login(body, res);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Refresh access token using the httpOnly refresh-token cookie',
  })
  @ApiOkResponse({ description: 'New access token issued' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired refresh token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = (req.cookies as Record<string, string>)[
      'refresh_token'
    ];
    return this.authService.refresh(refreshToken, res);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and clear the refresh-token cookie' })
  @ApiOkResponse({ description: 'Logged out successfully' })
  logout(@Res({ passthrough: true }) res: Response) {
    return this.authService.logout(res);
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: AuthRequestDTO })
  @ApiOkResponse({ description: 'Registration successful', type: AuthRegisterDTO })
  @ApiUnauthorizedResponse({ description: 'User already exists' })
  async register(@Body() body: AuthRequestDTO, @Res({ passthrough: true }) res: Response) {
    return this.authService.register(body, res);
  }
}
