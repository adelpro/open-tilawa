import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { MailerService } from '../src/mailer/mailer.service';
import type { MailMessage, MailTransport } from '../src/mailer/mailer.types';
import type { TempLinksService } from '../src/temp-links/temp-links.service';

/**
 * The activation link is the one URL an unactivated account can still use. It
 * shipped as `/me/account-activation/<token>` — an upstream path this router
 * never had — so every new account landed on a page that could not activate it.
 * The router owns `/activate/<token>`; keep the template and the router honest.
 */
describe('mailer templates', () => {
  const sent: MailMessage[] = [];
  const transport: MailTransport = {
    kind: 'smtp',
    send: async (message) => {
      sent.push(message);
      return { messageId: 'test' };
    },
  };
  const config = new ConfigService({
    APP_NAME: 'Tilawah.cc',
    WEBSITE: 'https://console.tilawah.cc',
    TEMP_JWT_SECRET: 'test-temp-secret',
    TEMP_JWT_TTL_MS: '900000',
  });
  const mailer = new MailerService(
    transport,
    new JwtService(),
    config,
    { issue: () => ({ jti: 'test-jti' }) } as unknown as TempLinksService,
  );

  beforeEach(() => {
    sent.length = 0;
  });

  it('sends the English activation link to the router path', async () => {
    await mailer.sendActivationEmail({
      id: 7,
      email: 'user@example.com',
      name: 'A',
      locale: 'en',
    });

    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe('Activate your Tilawah.cc account');
    expect(sent[0].html).toContain('https://console.tilawah.cc/activate/');
    expect(sent[0].html).not.toContain('/me/account-activation/');
    // Every mail links the public site: the logo and the brand line are the way back.
    expect(sent[0].html).toContain('https://tilawah.cc/images/logo.png');
    expect(sent[0].html).toContain('href="https://tilawah.cc"');
  });

  it('sends the Arabic activation link to the same router path', async () => {
    await mailer.sendActivationEmail({
      id: 8,
      email: 'user@example.com',
      name: 'A',
      locale: 'ar',
    });

    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe('تنشيط حسابك في Tilawah.cc');
    expect(sent[0].html).toContain('https://console.tilawah.cc/activate/');
    expect(sent[0].html).not.toContain('/me/account-activation/');
  });
});
