import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '@/auth/decorators/currentUser.decorator';
import { JWTAuthGuard } from '@/auth/guards/jwt.guard';
import { MeService } from './me.service';

/**
 * Email changes are always verified through a link sent to the new address.
 * The old address receives a notice after the switch, but it is never asked to
 * approve it.
 */
@UseGuards(JWTAuthGuard)
@Controller('me/email-change')
export class MeEmailChangeController {
  constructor(private readonly meService: MeService) {}

  @Throttle({ default: { limit: 3, ttl: 900_000 } })
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Request a verified email change' })
  @ApiBody({
    schema: { example: { newEmail: 'new@example.com', password: '...', totp: '123456' } },
  })
  @ApiResponse({
    status: 202,
    description: 'If the request is valid, a link was sent to the new address',
  })
  async requestEmailChange(
    @CurrentUser('id') id: string | number,
    @Body() body: { newEmail?: string; password?: string; totp?: string },
  ): Promise<{ message: string }> {
    const newEmail = typeof body.newEmail === 'string' ? body.newEmail.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!newEmail || !password) {
      throw new BadRequestException('newEmail and password are required');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      throw new BadRequestException('Invalid email address');
    }
    return this.meService.requestEmailChange(id, newEmail, password, body.totp);
  }
}
