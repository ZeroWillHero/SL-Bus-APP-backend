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
  ApiBasicAuth,
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
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
import { VerifyOtpDto, VerifyRequestResponseDto, VerifyResponseDto } from './dto/verify.dto';
import { Public } from '../../common/decorators/public.decorator';
import { AuthenticatedUser } from './strategies/jwt.strategy';

@ApiTags('Auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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

  // ─── Account verification ─────────────────────────────────────────────────────

  @Post('verify/request')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Request a verification OTP for the authenticated user',
    description:
      'Generates a 6-digit OTP valid for 15 minutes. ' +
      'In production this would be delivered via email or SMS. ' +
      'The OTP is returned in the response for development convenience.',
  })
  @ApiOkResponse({ type: VerifyRequestResponseDto })
  async requestVerification(
    @Req() req: Request,
  ): Promise<VerifyRequestResponseDto> {
    const user = req.user as AuthenticatedUser;
    return this.authService.requestVerification(user.userId);
  }

  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify account using the OTP received from /verify/request',
  })
  @ApiBody({ type: VerifyOtpDto })
  @ApiOkResponse({ type: VerifyResponseDto })
  async verify(@Body() body: VerifyOtpDto): Promise<VerifyResponseDto> {
    return this.authService.verifyAccount(body.token);
  }
}
