import { Logger } from '@nestjs/common';
import type { SettingsService } from '@/settings/settings.service';
import { MailMessage, MailNotConfiguredError, MailTransport } from './mailer.types';
import { gmailTransport, smtpTransport } from './mailer.transport';

type Builders = {
  smtp: (config: ReturnType<SettingsService['getMailConfig']>) => MailTransport;
  gmail: (email: string, pass: string) => MailTransport;
};

const NOT_CONFIGURED = 'Mail is not configured — set it in the console at /console/settings';

/** Stands in for "nothing is configured", so `kind` and `send` agree. */
const NULL_TRANSPORT: MailTransport = {
  kind: 'null',
  async send(): Promise<{ messageId: string }> {
    throw new MailNotConfiguredError(NOT_CONFIGURED);
  },
};

/**
 * The transport the rest of the app injects.
 *
 * It resolves the current configuration per send, so a console save takes effect
 * without a restart. The memo is keyed on the resolved values rather than
 * dropped by callers: `reload()` exists for the explicit case, but a save that
 * forgets it still cannot send through yesterday's server.
 *
 * Precedence is console → environment → nothing. The environment is not a
 * fallback in the usual sense: it is the only configuration that exists before
 * the first admin can sign in, because the setup token is mailed by that path.
 */
export class ConfiguredMailTransport implements MailTransport {
  private readonly logger = new Logger(ConfiguredMailTransport.name);
  private memo: { key: string; transport: MailTransport } | null = null;

  constructor(
    private readonly settings: Pick<SettingsService, 'getMailConfig'>,
    private readonly env: { email?: string; pass?: string },
    private readonly builders: Builders = { smtp: smtpTransport, gmail: gmailTransport },
  ) {}

  get kind(): 'smtp' | 'null' {
    return this.current().kind;
  }

  reload(): void {
    this.memo = null;
  }

  async send(message: MailMessage): Promise<{ messageId: string }> {
    const transport = this.current();
    this.logger.debug(`sending "${message.subject}" through ${transport.kind}`);
    return transport.send(message);
  }

  /** Which configuration wins, and the identity used to detect a change. */
  private describe(): { key: string; build: () => MailTransport } {
    const config = this.settings.getMailConfig();
    // A username with no readable password is not a usable login: that is the
    // rotated-secret case, and the environment is the better answer.
    const usable = Boolean(config.host) && (!config.user || Boolean(config.password));

    if (usable && config.host) {
      return {
        key: `smtp:${config.host}:${config.port}:${config.tls}:${config.user ?? ''}:${config.password ?? ''}`,
        build: () => this.builders.smtp(config),
      };
    }
    if (this.env.email && this.env.pass) {
      return {
        key: `gmail:${this.env.email}:${this.env.pass}`,
        build: () => this.builders.gmail(this.env.email as string, this.env.pass as string),
      };
    }
    return { key: 'null', build: () => NULL_TRANSPORT };
  }

  private current(): MailTransport {
    const next = this.describe();
    if (!this.memo || this.memo.key !== next.key) {
      this.memo = { key: next.key, transport: next.build() };
    }
    return this.memo.transport;
  }
}
