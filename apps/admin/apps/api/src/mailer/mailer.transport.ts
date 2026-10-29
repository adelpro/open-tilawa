import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { MailConfig } from '@/settings/settings.service';
import { MailMessage, MailTransport } from './mailer.types';

/**
 * The nodemailer boundary.
 *
 * This file knows how to turn a configuration into a transport and nothing about
 * where the configuration came from — that is `configured.transport.ts`, so a
 * test can drive precedence without opening a socket.
 */

const TIMEOUT_MS = 8_000;

/**
 * The return path.
 *
 * A blank From must fall through to the username — the console's own hint says so.
 * `??` is not enough: the saved value is an empty string, which is not nullish and
 * would ship a message with no From header at all.
 */
export function resolveFrom(config: MailConfig): string | undefined {
  return config.from?.trim() || config.user || undefined;
}

function sendOptions(config: MailConfig, message: MailMessage) {
  return {
    from: message.from ?? resolveFrom(config),
    to: message.to,
    subject: message.subject,
    html: message.html,
  };
}

/** Any provider. `tls` maps onto nodemailer's two switches, not its presets. */
export function smtpTransport(config: MailConfig): MailTransport {
  const transporter = nodemailer.createTransport({
    host: config.host ?? '',
    port: config.port,
    secure: config.tls === 'ssl',
    requireTLS: config.tls === 'starttls',
    // An unauthenticated relay is legitimate on a private network; nodemailer
    // then gets no `auth` at all rather than empty credentials.
    auth: config.user && config.password ? { user: config.user, pass: config.password } : undefined,
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: 15_000,
  });

  return {
    kind: 'smtp',
    async send(message: MailMessage): Promise<{ messageId: string }> {
      const info = await transporter.sendMail(sendOptions(config, message));
      return { messageId: info.messageId };
    },
    close(): void {
      transporter.close();
    },
  };
}

/** The environment path: `EMAIL` + `EMAIL_APP_SPECIFIC_PASS`, unchanged. */
export function gmailTransport(email: string, pass: string): MailTransport {
  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: email, pass } });
  return {
    kind: 'smtp',
    async send(message: MailMessage): Promise<{ messageId: string }> {
      const info = await transporter.sendMail({
        from: message.from ?? email,
        to: message.to,
        subject: message.subject,
        html: message.html,
      });
      return { messageId: info.messageId };
    },
    close(): void {
      transporter.close();
    },
  };
}

/**
 * Proves a configuration before it is saved, so a typo cannot replace a working
 * transport. Not every server implements enough for `verify()` to succeed — the
 * console offers an explicit override for those, and this throws the provider's
 * own message either way.
 */
export async function verifyMailConfig(config: MailConfig, timeoutMs = 10_000): Promise<void> {
  const transporter: Transporter = nodemailer.createTransport({
    host: config.host ?? '',
    port: config.port,
    secure: config.tls === 'ssl',
    requireTLS: config.tls === 'starttls',
    auth: config.user && config.password ? { user: config.user, pass: config.password } : undefined,
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
  });

  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      transporter.verify(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`SMTP verify timed out after ${timeoutMs} ms`)),
          timeoutMs,
        );
        timer.unref?.();
      }),
    ]);
  } finally {
    clearTimeout(timer);
    transporter.close();
  }
}
