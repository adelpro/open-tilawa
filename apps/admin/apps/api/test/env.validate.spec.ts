import { envValidate } from '../src/config/env/env.validate';

/**
 * `WEBSITE` is the origin stamped into activation and reset mail. A loopback
 * value is correct on a laptop and broken in production, and the failure is
 * invisible until a user clicks a dead link — so production refuses to boot.
 */
describe('envValidate — WEBSITE', () => {
  const production = {
    NODE_ENV: 'production',
    COOKIE_JWT_SECRET: 'cookie',
    TEMP_JWT_SECRET: 'temp',
    TILAWA_PEPPER: 'pepper',
  };

  it('accepts a public origin in production', () => {
    const config = envValidate({
      ...production,
      WEBSITE: 'https://admin-tilawa.quran.us.kg',
    });
    expect(config.WEBSITE).toBe('https://admin-tilawa.quran.us.kg');
  });

  it.each([
    'http://localhost:9400',
    'http://127.0.0.1:9400',
    'http://localhost',
    'https://localhost:9400/admin',
  ])('refuses %s in production', (website) => {
    expect(() => envValidate({ ...production, WEBSITE: website })).toThrow(/WEBSITE/);
  });

  it('refuses the built-in localhost default when WEBSITE is absent', () => {
    expect(() => envValidate({ ...production })).toThrow(/WEBSITE/);
  });

  it('still allows localhost outside production', () => {
    const config = envValidate({ NODE_ENV: 'development' });
    expect(config.WEBSITE).toBe('http://localhost:9320');
  });
});
