import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SetupService } from './setup.service';

@Controller('setup')
export class SetupController {
  constructor(private readonly setup: SetupService) {}

  @Get('status')
  @ApiOperation({ summary: 'Whether the initial super-admin setup is still required' })
  status(): { required: boolean } {
    return { required: this.setup.setupRequired() };
  }

  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Consume a setup token and create the super_admin account' })
  @ApiResponse({ status: 201, description: 'Super-admin created' })
  @ApiResponse({ status: 400, description: 'Invalid token or setup already complete' })
  async create(
    @Body() body: { token: string; name: string; email: string; password: string },
  ): Promise<{ id: number; email: string }> {
    return this.setup.consume(body.token, {
      name: body.name,
      email: body.email,
      password: body.password,
    });
  }
}
