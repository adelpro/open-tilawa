import { Body, Controller, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthService } from '@/auth/auth.service';
import { Fingerprint } from '@/auth/decorators/fingerprint.decorator';
import { FingerprintObj } from '@/auth/types/fingerprint.type';
import { OwnerService } from './owner.service';

/** Public: the mailed token is the credential, exactly like activation. */
@Controller('auth')
export class OwnerTransferController {
  constructor(
    private readonly owner: OwnerService,
    private readonly auth: AuthService,
  ) {}

  @Post('owner-transfer/confirm')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @ApiOperation({ summary: 'Accept an ownership transfer from the emailed link' })
  @ApiResponse({ status: 200, description: 'Ownership transferred' })
  async confirm(
    @Body() body: { token: string },
    @Fingerprint() fingerprint: FingerprintObj,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string; owner: { id: number; name: string; email: string } }> {
    const result = await this.owner.confirm(body.token, fingerprint);
    response.cookie('token', result.token, this.auth.getCookieOptions());
    return { message: result.message, owner: result.owner };
  }
}
