import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TempLinksService } from '@/temp-links/temp-links.service';
import type { TempLinkPurpose } from '@/temp-links/temp-links.service';
import { MAIL_TRANSPORT, MailMessage, MailNotConfiguredError, MailTransport } from './mailer.types';
import type { Locale } from '@tilawa-admin/core';
import * as path from 'path';
import * as fs from 'fs';

/** Who an email is about: the four fields every template interpolates. */
export interface MailRecipient {
  id: number | string;
  email: string;
  name: string;
  /**
   * The language to write in. Absent means English: every account created before
   * migration 006 has `locale = 'en'`, and a caller that forgets this field gets the
   * language the product is written in rather than a mixed message.
   */
  locale?: Locale;
}

/**
 * Renders the four ported templates and sends them through one transport.
 *
 * Three deliberate differences from `nextpalestine`'s `MailerService`:
 *
 * 1. **Every send is awaited.** Upstream passed a `(error, info) => …` callback
 *    and returned `void`; the caller's `await` resolved before the SMTP
 *    conversation happened, and a failure only reached a `console.log`. A 502
 *    from this service now means "the mail did not go out".
 * 2. **One transporter, injected.** See `mailer.transport.ts`.
 * 3. **A missing user is a typed throw, not a silent skip.** The controllers
 *    that must not enumerate accounts catch it and answer generically; the ones
 *    that operate on the caller cannot hit it at all.
 *
 * Templates are read once in the constructor, which is also why `nest-cli.json`
 * lists them as assets and the Dockerfile copies them explicitly: a missing
 * template exits the process at boot rather than at the first signup.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly registrationEmailTemplate: string;
  private readonly activationEmailTemplate: string;
  private readonly resetPasswordEmailTemplate: string;
  private readonly otpEmailTemplate: string;
  private readonly registrationEmailTemplateAr: string;
  private readonly activationEmailTemplateAr: string;
  private readonly resetPasswordEmailTemplateAr: string;
  private readonly otpEmailTemplateAr: string;
  private readonly alertEmailTemplate: string;
  private readonly alertEmailTemplateAr: string;
  private readonly digestEmailTemplate: string;
  private readonly digestEmailTemplateAr: string;

  constructor(
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly links: TempLinksService,
  ) {
    this.registrationEmailTemplate = this.load('registration.email.template.html');
    this.activationEmailTemplate = this.load('activation.email.template.html');
    this.resetPasswordEmailTemplate = this.load('reset.password.email.template.html');
    this.otpEmailTemplate = this.load('otp.email.template.html');
    // The Arabic variants are loaded here too, not lazily: a missing translation is
    // then a boot failure like a missing template, instead of an Arabic account
    // receiving English the first time it asks for a reset link.
    this.registrationEmailTemplateAr = this.load('registration.email.template.ar.html');
    this.activationEmailTemplateAr = this.load('activation.email.template.ar.html');
    this.resetPasswordEmailTemplateAr = this.load('reset.password.email.template.ar.html');
    this.otpEmailTemplateAr = this.load('otp.email.template.ar.html');
    this.alertEmailTemplate = this.load('alert.email.template.html');
    this.alertEmailTemplateAr = this.load('alert.email.template.ar.html');
    this.digestEmailTemplate = this.load('digest.email.template.html');
    this.digestEmailTemplateAr = this.load('digest.email.template.ar.html');
  }

  /** The template for the recipient's language. */
  private template(locale: Locale | undefined, english: string, arabic: string): string {
    return locale === 'ar' ? arabic : english;
  }

  /** The subject for the recipient's language. */
  private subject(locale: Locale | undefined, english: string, arabic: string): string {
    const base = locale === 'ar' ? arabic : english;
    const prefix = this.configService.get<string>('EMAIL_SUBJECT_PREFIX')?.trim();
    return prefix ? `${prefix} ${base}` : base;
  }

  private load(file: string): string {
    return fs.readFileSync(path.join(__dirname, 'templates', file), 'utf-8');
  }

  /** False on a host with no Gmail credentials, which is every dev machine. */
  get isConfigured(): boolean {
    return this.transport.kind !== 'null';
  }

  private get appName(): string {
    return this.configService.get<string>('APP_NAME') ?? 'Tilawa Admin';
  }

  private get website(): string {
    return this.configService.get<string>('WEBSITE') ?? 'http://localhost:9320';
  }

  private fill(template: string, values: Record<string, string>): string {
    return Object.entries(values).reduce(
      (html, [key, value]) => html.split(`{{${key}}}`).join(value),
      template,
    );
  }

  private async deliver(message: MailMessage): Promise<{ messageId: string }> {
    try {
      const info = await this.transport.send(message);
      this.logger.log(`sent "${message.subject}" to ${message.to} (${info.messageId})`);
      return info;
    } catch (err) {
      if (err instanceof MailNotConfiguredError) {
        // 503, not 500: the account system is fine, the deployment is not
        // finished. The body names the variables so the fix is obvious.
        throw new ServiceUnavailableException(err.message);
      }
      this.logger.error(`send to ${message.to} failed: ${(err as Error).message}`);
      throw new BadGatewayException('Failed to send email');
    }
  }

  /**
   * The activation and reset links both carry this token: a short-lived JWT
   * signed with `TEMP_JWT_SECRET`, deliberately not the session secret, so a
   * stolen link cannot be replayed as a session and vice versa.
   */
  private async temporaryToken(
    id: number | string,
    email: string,
    purpose: TempLinkPurpose,
    options: { ttlMs?: number; extra?: Record<string, unknown> } = {},
  ): Promise<string> {
    const ttlMs =
      options.ttlMs ?? Number(this.configService.get<string>('TEMP_JWT_TTL_MS') ?? 900_000);
    const { jti } = this.links.issue(id, purpose, ttlMs);
    return this.jwtService.signAsync(
      { id, email, purpose, jti, ...options.extra },
      {
        secret: this.configService.get<string>('TEMP_JWT_SECRET'),
        expiresIn: Math.floor(ttlMs / 1000),
      },
    );
  }

  async sendRegistrationEmail(
    recipient: MailRecipient,
    password: string,
  ): Promise<{ messageId: string }> {
    return this.deliver({
      to: recipient.email,
      subject: this.subject(
        recipient.locale,
        `Welcome ${recipient.name} to ${this.appName}`,
        `مرحبًا ${recipient.name} في ${this.appName}`,
      ),
      html: this.fill(
        this.template(
          recipient.locale,
          this.registrationEmailTemplate,
          this.registrationEmailTemplateAr,
        ),
        {
          APP_NAME: this.appName,
          name: recipient.name,
          email: recipient.email,
          password,
        },
      ),
    });
  }

  async sendActivationEmail(recipient: MailRecipient): Promise<{ messageId: string }> {
    const token = await this.temporaryToken(recipient.id, recipient.email, 'activation');
    return this.deliver({
      to: recipient.email,
      subject: this.subject(
        recipient.locale,
        `Activate your ${this.appName} account`,
        `تنشيط حسابك في ${this.appName}`,
      ),
      html: this.fill(
        this.template(
          recipient.locale,
          this.activationEmailTemplate,
          this.activationEmailTemplateAr,
        ),
        {
          APP_NAME: this.appName,
          website: this.website,
          token,
          name: recipient.name,
          email: recipient.email,
        },
      ),
    });
  }

  async sendResetPasswordEmail(recipient: MailRecipient): Promise<{ messageId: string }> {
    const token = await this.temporaryToken(recipient.id, recipient.email, 'reset');
    return this.deliver({
      to: recipient.email,
      subject: this.subject(
        recipient.locale,
        `Reset your ${this.appName} password`,
        `إعادة تعيين كلمة المرور في ${this.appName}`,
      ),
      html: this.fill(
        this.template(
          recipient.locale,
          this.resetPasswordEmailTemplate,
          this.resetPasswordEmailTemplateAr,
        ),
        {
          APP_NAME: this.appName,
          website: this.website,
          token,
          name: recipient.name,
          email: recipient.email,
        },
      ),
    });
  }

  async sendOTPCodeToEmail(recipient: MailRecipient, otp: string): Promise<{ messageId: string }> {
    return this.deliver({
      to: recipient.email,
      subject: this.subject(
        recipient.locale,
        `Your ${this.appName} verification code`,
        `رمز التحقق في ${this.appName}`,
      ),
      html: this.fill(
        this.template(recipient.locale, this.otpEmailTemplate, this.otpEmailTemplateAr),
        {
          APP_NAME: this.appName,
          name: recipient.name,
          code: otp,
          email: recipient.email,
        },
      ),
    });
  }

  /**
   * An operational alert. Every value here is already escaped by the caller and
   * already localised by `notifications/messages.ts`: this method only picks the
   * template and hands it to the transport.
   */
  async sendAlertEmail(
    recipient: MailRecipient,
    alert: { subject: string; heading: string; resource: string; detail: string; openedAt: string },
  ): Promise<{ messageId: string }> {
    const consoleUrl = `${this.website.replace(/\/$/, '')}/console/status`;
    return this.deliver({
      to: recipient.email,
      subject: this.subject(recipient.locale, alert.subject, alert.subject),
      html: this.fill(
        this.template(recipient.locale, this.alertEmailTemplate, this.alertEmailTemplateAr),
        {
          APP_NAME: this.appName,
          name: recipient.name,
          email: recipient.email,
          heading: alert.heading,
          resource: alert.resource,
          detail: alert.detail,
          openedAt: alert.openedAt,
          consoleUrl,
        },
      ),
    });
  }

  /**
   * The daily status mail. `rows` is pre-built, pre-escaped table markup: this
   * method owns the frame, not the content.
   */
  async sendDigestEmail(
    recipient: MailRecipient,
    digest: { degraded: boolean; broken: number; open: number; rows: string },
  ): Promise<{ messageId: string }> {
    const consoleUrl = `${this.website.replace(/\/$/, '')}/console/status`;
    const arabic = recipient.locale === 'ar';
    const heading = arabic
      ? digest.degraded
        ? 'الحالة اليومية: أعطال قائمة'
        : 'الحالة اليومية: كل الأنظمة تعمل'
      : digest.degraded
        ? `Daily status: ${digest.broken} down`
        : 'Daily status: all systems up';
    const summary = arabic
      ? digest.degraded
        ? `${digest.broken} عنصرًا خارج الخدمة، و${digest.open} تنبيهًا قائمًا.`
        : `لا شيء خارج الخدمة، و${digest.open} تنبيهًا قائمًا.`
      : digest.degraded
        ? `${digest.broken} element${digest.broken === 1 ? '' : 's'} down, ${digest.open} alert${digest.open === 1 ? '' : 's'} open.`
        : `Nothing is down; ${digest.open} alert${digest.open === 1 ? '' : 's'} open.`;

    return this.deliver({
      to: recipient.email,
      subject: this.subject(recipient.locale, heading, heading),
      html: this.fill(
        this.template(recipient.locale, this.digestEmailTemplate, this.digestEmailTemplateAr),
        {
          APP_NAME: this.appName,
          name: recipient.name,
          email: recipient.email,
          heading,
          summary,
          rows: digest.rows,
          consoleUrl,
        },
      ),
    });
  }

  /** Proves the configured transport end to end, without a template. */
  async sendTestEmail(recipient: MailRecipient): Promise<{ messageId: string }> {
    const consoleUrl = `${this.website.replace(/\/$/, '')}/console/settings`;
    return this.deliver({
      to: recipient.email,
      subject: this.subject(
        recipient.locale,
        `Test message from ${this.appName}`,
        `رسالة تجريبية من ${this.appName}`,
      ),
      html: `<p>This is a test message from ${this.appName}.</p><p>If you are reading it, the SMTP configuration works. Manage it at <a href="${consoleUrl}">${consoleUrl}</a>.</p>`,
    });
  }

  async sendSetupToken(
    to: string,
    token: string,
    baseUrl?: string,
  ): Promise<{ messageId: string }> {
    const link = baseUrl ? `${baseUrl.replace(/\/$/, '')}/setup?token=${token}` : null;
    const linkHtml = link
      ? `<p>Or open this link (the token is pre-filled): <a href="${link}">${link}</a></p>`
      : '';
    return this.deliver({
      to,
      subject: `Tilawa Admin setup token (valid 1 hour, single use)`,
      html: `<p>Your Tilawa Admin super-admin setup token is:</p><p style="font-family:monospace;font-size:16px">${token}</p>${linkHtml}<p>It is valid for one hour and can be used once. Visit <code>/setup</code> and enter the token with your credentials.</p><p>If you did not request this, ignore this email and rotate the deployment.</p>`,
    });
  }
  static requireRecipient(user: MailRecipient | null): MailRecipient {
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
