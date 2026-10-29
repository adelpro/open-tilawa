import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuditRepository } from '@tilawa-admin/core';
import { ConfigService } from '@nestjs/config';
import { ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '@/auth/decorators/currentUser.decorator';
import { Roles } from '@/auth/decorators/roles.decorator';
import { JWTAuthGuard } from '@/auth/guards/jwt.guard';
import { RoleGuard } from '@/auth/guards/roles.guard';
import type { AuthenticatedUser } from '@/auth/types/authenticatedUser.type';
import { MailerService } from '@/mailer/mailer.service';
import { MAIL_TRANSPORT } from '@/mailer/mailer.types';
import type { MailTransport } from '@/mailer/mailer.types';
import { verifyMailConfig } from '@/mailer/mailer.transport';
import { SettingsService } from './settings.service';
import type { MailConfig, MailTls } from './settings.service';

interface MailBody {
  host?: string;
  port?: number | string;
  tls?: MailTls;
  user?: string;
  from?: string;
  password?: string | null;
  force?: boolean;
}

/**
 * Outbound mail, configured at runtime.
 *
 * Two rules shape this controller. A save is verified before it is written, so a
 * typo cannot replace a working transport with a broken one; and nothing it
 * returns ever includes the password or its ciphertext, only `hasPassword` —
 * the same shape `/seeders` uses for node credentials.
 *
 * It lives in `MailerModule`, not `SettingsModule`, because it needs the mailer
 * and the transport, and `MailerModule` is the side that imports the settings
 * service. Registering it the other way round would close a provider cycle.
 */
@UseGuards(JWTAuthGuard, RoleGuard)
@Roles('admin')
@Controller('settings/mail')
export class MailSettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
    @Inject(AuditRepository) private readonly audit: AuditRepository,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'The outbound mail configuration (never the password)' })
  read() {
    return this.publicState();
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save the outbound mail configuration, after verifying it' })
  async save(@Body() body: MailBody, @CurrentUser() user: AuthenticatedUser) {
    const current = this.settings.getMailConfig();
    const port = Number(body?.port ?? current.port);
    const tls = body?.tls ?? current.tls;

    // `undefined` and '' both mean "keep the stored password"; the service
    // enforces the same rule, and the candidate below repeats it because the
    // verification needs the real value.
    const provided = body?.password;
    const password = provided === undefined || provided === '' ? current.password : provided;

    if (!body?.force) {
      const candidate: MailConfig = {
        ...current,
        host: body?.host?.trim() || current.host,
        port,
        tls,
        user: body?.user?.trim() || null,
        from: body?.from?.trim() || null,
        password,
        hasPassword: Boolean(password),
      };
      try {
        await verifyMailConfig(candidate);
      } catch (error) {
        throw new BadRequestException(`SMTP verify failed: ${(error as Error).message}`);
      }
    }

    const saved = this.settings.setMailConfig({
      host: body?.host ?? current.host ?? '',
      port,
      tls,
      user: body?.user ?? current.user ?? '',
      from: body?.from ?? current.from ?? '',
      password: provided === undefined || provided === '' ? undefined : provided,
      verifiedAt: body?.force ? null : new Date().toISOString(),
    });

    this.transport.reload?.();
    this.audit.record({
      actorId: Number(user.id),
      action: 'settings.mail.updated',
      target: saved.host ?? undefined,
      after: { host: saved.host, port: saved.port, tls: saved.tls, user: saved.user, from: saved.from },
    });
    return this.publicState();
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Drop the console configuration and fall back to the environment' })
  clear(@CurrentUser() user: AuthenticatedUser) {
    this.settings.clearMailConfig();
    this.transport.reload?.();
    this.audit.record({
      actorId: Number(user.id),
      action: 'settings.mail.cleared',
      status: 'ok',
    });
    return this.publicState();
  }

  /**
   * Mails the caller and nobody else: accepting an address here would turn a
   * valid admin session into an open relay.
   */
  @Post('test')
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Send a test message to the signed-in admin' })
  test(@CurrentUser() user: AuthenticatedUser) {
    return this.mailer.sendTestEmail({
      id: user.id,
      email: user.email,
      name: user.name,
      locale: 'en',
    });
  }

  /** Field by field, never a spread: a spread is how a secret leaks. */
  private publicState() {
    const config = this.settings.getMailConfig();
    const envConfigured = Boolean(
      this.config.get<string>('EMAIL') && this.config.get<string>('EMAIL_APP_SPECIFIC_PASS'),
    );
    return {
      host: config.host,
      port: config.port,
      tls: config.tls,
      user: config.user,
      from: config.from,
      hasPassword: config.hasPassword,
      verifiedAt: config.verifiedAt,
      source: config.host ? 'db' : envConfigured ? 'env' : 'none',
    };
  }
}
