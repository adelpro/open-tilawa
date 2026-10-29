import { Logger } from '@nestjs/common';
import type { SettingsService } from '@/settings/settings.service';
import { MailMessage, MailNotConfiguredError, MailTransport } from './mailer.types';
import { gmailTransport, smtpTransport } from './mailer.transport';

type Builders = {
  smtp: (config: ReturnType<SettingsService['getMailConfig']>) => MailTransport;
  gmail: (email: string, pass: string) => MailTransport;
};

/**
 * Whether the stored configuration can actually send.
 *
 * Shared with the settings controller so the panel reports the source the
 * transport is really using: a stored host with a password this process cannot
 * read is *not* "console configuration in use".
 */
export function isMailConfigUsable(config: {
  host: string | null;
  user: string | null;
  password: string | null;
}): boolean {
  return Boolean(config.host) && (!config.user || Boolean(config.password));
}

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
    this.memo?.transport.close?.();
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

    if (isMailConfigUsable(config) && config.host) {
      return {
        // `from` belongs in the key: it is baked into the built transport.
        key: `smtp:${config.host}:${config.port}:${config.tls}:${config.user ?? ''}:${config.password ?? ''}:${config.from ?? ''}`,
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
      // Release the previous pool instead of leaking a socket per settings change.
      this.memo?.transport.close?.();
      this.memo = { key: next.key, transport: next.build() };
    }
    return this.memo.transport;
  }
}
