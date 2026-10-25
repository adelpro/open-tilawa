import * as nodemailer from 'nodemailer';
import { MailMessage, MailNotConfiguredError, MailTransport } from './mailer.types';

const REQUIRED = ['EMAIL', 'EMAIL_APP_SPECIFIC_PASS'] as const;

/**
 * One transporter for the process. The ported code built a new one per message,
 * which opens a fresh connection pool each time and hides configuration errors
 * until the first send.
 */
export function createMailTransport(
  config: { get<T = string>(key: string): T | undefined },
  logger: { warn(message: string): void } = console,
): MailTransport {
  const missing = REQUIRED.filter((key) => !config.get<string>(key));
  if (missing.length > 0) {
    logger.warn(
      `mail transport disabled — missing ${missing.join(', ')}; signup and password reset will answer 503 until they are set`,
    );
    return {
      kind: 'null',
      async send(): Promise<{ messageId: string }> {
        throw new MailNotConfiguredError(`Mail is not configured: set ${missing.join(' and ')}`);
      },
    };
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.get<string>('EMAIL'),
      pass: config.get<string>('EMAIL_APP_SPECIFIC_PASS'),
    },
  });

  return {
    kind: 'smtp',
    async send(message: MailMessage): Promise<{ messageId: string }> {
      const info = await transporter.sendMail({
        from: message.from ?? config.get<string>('EMAIL'),
        to: message.to,
        subject: message.subject,
        html: message.html,
      });
      return { messageId: info.messageId };
    },
  };
}
