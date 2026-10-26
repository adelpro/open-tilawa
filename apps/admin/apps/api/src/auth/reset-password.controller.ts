import { ApiBadRequestResponse, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ResetPasswordService } from './reset-password.service';
import { ResetPasswordDTO, SendResetEmailDTO } from './dtos/reset-password.dto';

/**
 * The public forgot-password routes the dashboard links to. Both answers are
 * generic on purpose — see `ResetPasswordService`.
 */
@Controller('reset-password')
export class ResetPasswordController {
  constructor(private readonly reset: ResetPasswordService) {}

  @Post('send-email')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Send a single-use password reset link by email' })
  @ApiOkResponse({ description: 'Always a generic confirmation' })
  @ApiBadRequestResponse({ description: 'Malformed email' })
  async sendEmail(@Body() body: SendResetEmailDTO) {
    return this.reset.sendEmail(body.email);
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Consume an emailed reset link and set a new password' })
  @ApiOkResponse({ description: 'Password changed, sessions revoked' })
  @ApiBadRequestResponse({ description: 'Missing fields' })
  async validate(@Body() body: ResetPasswordDTO) {
    return this.reset.validate(body.token, body.password);
  }
}
