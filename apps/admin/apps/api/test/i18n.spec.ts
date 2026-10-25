import { bootHarness, tokenFromMail, type Harness } from './harness';

/**
 * P10 over HTTP: the locale is stored, it survives, it is validated, and it decides
 * the language of what the server sends.
 *
 * The mail assertions are the point. A catalogue that only changes the SPA leaves
 * an Arabic account receiving an English activation link, and the link is the one
 * message a new account cannot avoid reading.
 */
describe('interface language', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await bootHarness();
  });

  afterAll(async () => {
    await h.close();
  });

  const signUpAndActivate = async (email: string): Promise<ReturnType<Harness['agent']>> => {
    await h
      .agent()
      .post('/api/auth/local/signup')
      .send({ user: { name: 'Nadia', email, password: 'Password123' } })
      .expect(201);

    const agent = h.agent();
    await agent
      .post('/api/auth/local/activate')
      .send({ token: tokenFromMail(h.mail.last()) })
      .expect(200);
    return agent;
  };

  it('defaults to English and reports it on /api/me', async () => {
    const agent = await signUpAndActivate('default.locale@example.com');
    const me = await agent.get('/api/me').expect(200);
    expect(me.body.locale).toBe('en');
    // The first mail is in the language the account was created in.
    const activation = h.mail.sent.find((message) => message.to === 'default.locale@example.com');
    expect(activation?.subject).toContain('Activate');
    expect(activation?.html).toContain('lang="en"');
  });

  it('stores a new locale on the account and returns it afterwards', async () => {
    const agent = await signUpAndActivate('switches.to.arabic@example.com');

    await agent
      .patch('/api/me')
      .send({ user: { locale: 'ar' } })
      .expect(200);

    const me = await agent.get('/api/me').expect(200);
    expect(me.body.locale).toBe('ar');
    // The row, not just the response: a second device reads the same value.
    expect(h.users.getByEmail('switches.to.arabic@example.com')?.locale).toBe('ar');
  });

  it('refuses a language it does not have', async () => {
    const agent = await signUpAndActivate('bad.locale@example.com');
    const res = await agent
      .patch('/api/me')
      .send({ user: { locale: 'fr' } })
      .expect(400);
    expect(JSON.stringify(res.body)).toContain('en or ar');
  });

  it('sends the next mail in the stored language, right to left', async () => {
    const email = 'arabic.mail@example.com';
    const agent = await signUpAndActivate(email);

    await agent
      .patch('/api/me')
      .send({ user: { locale: 'ar' } })
      .expect(200);

    // The reset link is the next message this account can ask for. A resend would be a
    // no-op: the account is already active.
    h.mail.clear();
    await h.agent().post('/api/reset-password/send-email').send({ email });

    const mail = h.mail.last();
    expect(mail.to).toBe(email);
    // Arabic subject, Arabic body, and the direction declared — an Arabic body in an
    // ltr document is a wall of reversed punctuation in half the clients that matter.
    expect(mail.subject).toMatch(/[\u0600-\u06FF]/);
    expect(mail.html).toContain('dir="rtl"');
    expect(mail.html).toContain('lang="ar"');
    expect(mail.html).toContain('إعادة تعيين كلمة المرور');
    // The link is untouched by translation.
    expect(mail.html).toContain('/reset-password/');
  });

  it('keeps English for an account that never changed it', async () => {
    const email = 'english.mail@example.com';
    await h
      .agent()
      .post('/api/auth/local/signup')
      .send({ user: { name: 'Nadia', email, password: 'Password123' } })
      .expect(201);

    const mail = h.mail.last();
    expect(mail.to).toBe(email);
    expect(mail.subject).toContain('Activate');
    expect(mail.html).toContain('lang="en"');
    expect(mail.html).not.toContain('dir="rtl"');
  });

  /**
   * The theme travels the same road as the language: stored on the row, returned
   * with the session, validated, and never part of any authorization decision.
   */
  it('defaults the theme to following the operating system', async () => {
    const agent = await signUpAndActivate('theme.default@example.com');
    const me = await agent.get('/api/me').expect(200);
    expect(me.body.theme).toBe('system');
  });

  it('stores a new theme on the account and returns it afterwards', async () => {
    const email = 'theme.stores@example.com';
    const agent = await signUpAndActivate(email);

    await agent
      .patch('/api/me')
      .send({ user: { theme: 'dark' } })
      .expect(200);

    const me = await agent.get('/api/me').expect(200);
    expect(me.body.theme).toBe('dark');
    // The row, not just the response: a second device reads the same value.
    expect(h.users.getByEmail(email)?.theme).toBe('dark');
  });

  it('refuses a theme it does not have', async () => {
    const agent = await signUpAndActivate('theme.invalid@example.com');
    const res = await agent
      .patch('/api/me')
      .send({ user: { theme: 'sepia' } })
      .expect(400);
    expect(JSON.stringify(res.body)).toContain('light, dark or system');
  });
});
