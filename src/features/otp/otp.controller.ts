import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpService } from './otp.service';

@ApiTags('OTP')
@Controller('api/v1/otp')
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Public()
  @Post('send')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send a one-time password via SMS' })
  @ApiOkResponse({ description: 'OTP sent successfully' })
  @ApiBadRequestResponse({ description: 'Invalid phone number' })
  send(@Body() body: SendOtpDto) {
    return this.otpService.send(body.phone);
  }

  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Verify a one-time password' })
  @ApiOkResponse({ description: 'OTP verified' })
  @ApiBadRequestResponse({ description: 'Invalid or expired OTP' })
  verify(@Body() body: VerifyOtpDto) {
    return this.otpService.verify(body.phone, body.code);
  }
}
