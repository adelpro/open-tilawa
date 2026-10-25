import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '@/auth/decorators/currentUser.decorator';
import { JWTAuthGuard } from '@/auth/guards/jwt.guard';
import { OwnerService } from './owner.service';

/** The Owner-only side of the handover: prove the credentials, mail the target. */
@Controller('me')
@UseGuards(JWTAuthGuard)
export class OwnerController {
  constructor(private readonly owner: OwnerService) {}

  @Post('owner-transfer')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @ApiOperation({ summary: 'Start an ownership transfer to another super admin' })
  @ApiResponse({ status: 202, description: 'Invitation sent' })
  async initiate(
    @CurrentUser('id') id: string | number,
    @Body() body: { email: string; password: string; totp?: string },
  ): Promise<{ message: string }> {
    return this.owner.initiate(id, body);
  }
}
