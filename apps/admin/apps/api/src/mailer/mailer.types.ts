/**
 * The mail boundary.
 *
 * The ported service called `transporter.sendMail(options, callback)` and
 * returned `void`, so a rejected send — bad app password, Gmail quota, no
 * network — was logged to the console and reported to the caller as success.
 * Signup then answered 201 for an account whose activation mail never left the
 * box. Every send now goes through this interface and is awaited.
 *
 * `null` is a real transport, not a missing one: development and CI have no
 * Gmail credentials, and a service that cannot render its templates or compose
 * a message should still boot. What it must not do is pretend a message was
 * sent, so the null transport throws `MailNotConfiguredError` and the service
 * maps that to 503 with the missing variable names in the body.
 */
export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface MailTransport {
  /** `smtp` sends; `null` refuses with MailNotConfiguredError. */
  readonly kind: 'smtp' | 'null';
  send(message: MailMessage): Promise<{ messageId: string }>;
}

export class MailNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MailNotConfiguredError';
  }
}

/** Injection token: tests override it with a recorder to read the messages. */
export const MAIL_TRANSPORT = 'USLUB_MAIL_TRANSPORT';
