import { bootHarness, tokenFromMail, type Harness } from './harness';

/** Ownership is the one flag that can hand the whole instance to another account. */
describe('owner transfer', () => {
  let h: Harness;
  let targetId: number;

  const ownerPassword = 'OwnerPass123';
  const targetPassword = 'TargetPass123';

  const signin = async (email: string, password: string) => {
    const agent = h.agent();
    await agent
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', `fp-${email}`)
      .send({ user: { email, password } })
      .expect(200);
    return agent;
  };

  beforeAll(async () => {
    h = await bootHarness();
    targetId = await h.seedUser({
      name: 'Next Owner',
      email: 'next-owner@example.com',
      password: targetPassword,
      role: 'super_admin',
    });
  });

  afterAll(async () => {
    await h.close();
  });

  it('refuses initiation from a non-owner and to a non-super-admin', async () => {
    const target = await signin('next-owner@example.com', targetPassword);
    // The seeded owner is the only Owner; the target is a plain super_admin.
    await target
      .post('/api/me/owner-transfer')
      .send({ email: h.ownerEmail, password: targetPassword })
      .expect(403);

    const owner = await signin(h.ownerEmail, ownerPassword);
    await owner
      .post('/api/me/owner-transfer')
      .send({ email: 'nobody@example.com', password: ownerPassword })
      .expect(400);
  });

  it('rejects a wrong password and a self-transfer', async () => {
    const owner = await signin(h.ownerEmail, ownerPassword);
    await owner
      .post('/api/me/owner-transfer')
      .send({ email: 'next-owner@example.com', password: 'wrong-password' })
      .expect(401);
    await owner
      .post('/api/me/owner-transfer')
      .send({ email: h.ownerEmail, password: ownerPassword })
      .expect(400);
  });

  it('moves the flag only after the target accepts, and revokes both sessions', async () => {
    const owner = await signin(h.ownerEmail, ownerPassword);
    const target = await signin('next-owner@example.com', targetPassword);

    h.mail.clear();
    const request = await owner
      .post('/api/me/owner-transfer')
      .send({ email: 'next-owner@example.com', password: ownerPassword })
      .expect(202);
    expect(request.body.message).toMatch(/sent/i);

    const invite = h.mail.last();
    expect(invite.to).toBe('next-owner@example.com');
    expect(invite.subject).toMatch(/owner|own/i);
    const token = tokenFromMail(invite);

    // Until acceptance, nothing has moved.
    expect(h.users.getOwner()?.email).toBe(h.ownerEmail);

    const accept = h.agent();
    const accepted = await accept
      .post('/api/auth/owner-transfer/confirm')
      .set('X-Fingerprint', 'fp-accept')
      .send({ token })
      .expect(200);
    expect(accepted.body.owner.email).toBe('next-owner@example.com');

    const ownerRow = h.users.getOwner();
    expect(ownerRow?.id).toBe(targetId);
    expect(ownerRow?.role).toBe('super_admin');
    expect(ownerRow?.isOwner).toBe(true);
    expect(ownerRow?.isActivated).toBe(true);

    // The previous Owner stays a super_admin; only the flag moved.
    const old = h.users.getByEmail(h.ownerEmail);
    expect(old?.role).toBe('super_admin');
    expect(old?.isOwner).toBe(false);

    // Both old sessions are gone: the old Owner must sign in again, and the
    // target's pre-acceptance session is dead even though they just accepted.
    await owner.get('/api/me').expect(401);
    await target.get('/api/me').expect(401);

    // The acceptance response set a fresh cookie for the new Owner.
    const me = await accept.get('/api/me').expect(200);
    expect(me.body.email).toBe('next-owner@example.com');
    expect(me.body.isOwner).toBe(true);
  });

  it('refuses a replayed acceptance link', async () => {
    // The previous test consumed the token; the mail is still in the recorder.
    const invite = h.mail.sent.find((mail) => mail.to === 'next-owner@example.com');
    expect(invite).toBeDefined();
    const token = tokenFromMail(invite!);
    await h
      .agent()
      .post('/api/auth/owner-transfer/confirm')
      .set('X-Fingerprint', 'fp-replay')
      .send({ token })
      .expect(401);
  });
});
