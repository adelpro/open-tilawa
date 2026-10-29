import { ConfiguredMailTransport } from '../src/mailer/configured.transport';
import { MailNotConfiguredError } from '../src/mailer/mailer.types';
import type { MailConfig } from '../src/settings/settings.service';

const MESSAGE = { to: 'ops@tilawah.cc', subject: 'hello', html: '<p>hi</p>' };

function config(overrides: Partial<MailConfig> = {}): MailConfig {
  return {
    host: null,
    port: 465,
    tls: 'ssl',
    user: null,
    from: null,
    password: null,
    hasPassword: false,
    verifiedAt: null,
    ...overrides,
  };
}

function recorder(id: string) {
  return {
    kind: 'smtp' as const,
    send: jest.fn(async () => ({ messageId: id })),
  };
}

function build(initial: MailConfig, env: { email?: string; pass?: string } = {}) {
  const state = { config: initial };
  const smtp = jest.fn((_c: MailConfig) => recorder('smtp'));
  const gmail = jest.fn((_e: string, _p: string) => recorder('gmail'));
  const transport = new ConfiguredMailTransport(
    { getMailConfig: () => state.config },
    env,
    { smtp, gmail },
  );
  return { transport, smtp, gmail, state };
}

describe('ConfiguredMailTransport', () => {
  it('uses the console configuration over the environment', async () => {
    const { transport, smtp, gmail } = build(
      config({ host: 'smtp.fastmail.com', port: 465, tls: 'ssl', user: 'ops', password: 'pw' }),
      { email: 'env@example.com', pass: 'envpass' },
    );

    expect(transport.kind).toBe('smtp');
    const info = await transport.send(MESSAGE);

    expect(smtp).toHaveBeenCalledTimes(1);
    expect(smtp.mock.calls[0][0]).toMatchObject({ host: 'smtp.fastmail.com', port: 465 });
    expect(gmail).not.toHaveBeenCalled();
    expect(info.messageId).toBe('smtp');
  });

  it('falls back to Gmail when only the environment pair exists', async () => {
    const { transport, smtp, gmail } = build(config(), {
      email: 'env@example.com',
      pass: 'envpass',
    });

    expect(transport.kind).toBe('smtp');
    await transport.send(MESSAGE);

    expect(gmail).toHaveBeenCalledWith('env@example.com', 'envpass');
    expect(smtp).not.toHaveBeenCalled();
  });

  it('is the null transport, and says where to fix it, when neither exists', async () => {
    const { transport } = build(config());

    expect(transport.kind).toBe('null');
    await expect(transport.send(MESSAGE)).rejects.toBeInstanceOf(MailNotConfiguredError);
    await expect(transport.send(MESSAGE)).rejects.toThrow(/console\/settings/);
  });

  it('switches to the new host after reload()', async () => {
    const { transport, smtp, state } = build(
      config({ host: 'old.example.com', user: 'u', password: 'p' }),
    );

    await transport.send(MESSAGE);
    state.config = config({ host: 'new.example.com', user: 'u', password: 'p' });
    transport.reload();
    await transport.send(MESSAGE);

    expect(smtp.mock.calls.map((call) => call[0].host)).toEqual([
      'old.example.com',
      'new.example.com',
    ]);
  });

  it('rebuilds without an explicit reload when the saved value changes', async () => {
    const { transport, smtp, state } = build(
      config({ host: 'old.example.com', user: 'u', password: 'p' }),
    );

    await transport.send(MESSAGE);
    state.config = config({ host: 'new.example.com', user: 'u', password: 'p' });
    await transport.send(MESSAGE);

    expect(smtp.mock.calls.map((call) => call[0].host)).toEqual([
      'old.example.com',
      'new.example.com',
    ]);
  });

  it('falls through to env when the stored password cannot be decrypted', async () => {
    const undecryptable = config({ host: 'smtp.example.com', user: 'ops', hasPassword: true });

    const withEnv = build(undecryptable, { email: 'env@example.com', pass: 'envpass' });
    expect(withEnv.transport.kind).toBe('smtp');
    await withEnv.transport.send(MESSAGE);
    expect(withEnv.gmail).toHaveBeenCalled();

    const withoutEnv = build(undecryptable);
    expect(withoutEnv.transport.kind).toBe('null');
  });
});
