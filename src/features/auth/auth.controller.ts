import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
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
import { AuthenticatedUser } from './strategies/jwt.strategy';

@ApiTags('Auth')
@Controller('api/v1/auth')
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
  @ApiForbiddenResponse({ description: 'Account not verified — OTP verification required' })
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

  @Public()
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
  @ApiBadRequestResponse({ description: 'User already exists' })
  async register(@Body() body: AuthRequestDTO, @Res({ passthrough: true }) res: Response) {
    return this.authService.register(body, res);
  }

  @Get('verify')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify the current access token and return the authenticated user' })
  @ApiOkResponse({ description: 'Token is valid, returns current user' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async verify(@Req() req: Request) {
    return this.authService.verify(req.user as AuthenticatedUser);
  }
}
