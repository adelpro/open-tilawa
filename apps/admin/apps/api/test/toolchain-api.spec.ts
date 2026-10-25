import { bootHarness, type Harness } from './harness';

/**
 * The per-profile toolchain over the dashboard API.
 *
 * The engine is where the validation lives (see core's toolchain spec); these
 * tests prove the HTTP surface obeys it: a chain rides create and update, an
 * invalid step is a 400 naming the reason, and an empty array resets to the
 * bundled default chain — the editor's "use the house default" state.
 */
describe('profiles: toolchain', () => {
  let h: Harness;
  let agent: ReturnType<Harness['agent']>;
  const account = { email: 'chain@example.com', password: 'Password123' };

  beforeAll(async () => {
    h = await bootHarness();
    await h.seedUser({ name: 'Chain User', email: account.email, password: account.password });
    agent = h.agent();
    await agent
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', 'chain-device')
      .send({ user: account })
      .expect(200);
  });

  afterAll(async () => {
    await h.close();
  });

  it('stores a chain on create and reports it on read', async () => {
    const created = await agent
      .post('/api/profiles')
      .send({
        name: 'chain-tone',
        manifest: { kind: 'voice', name: 'chain-tone', houseStyle: './h.json', version: '1.0.0' },
        toolchain: [{ kind: 'prompt', name: 'warmth', body: 'Keep the warmth.' }],
      })
      .expect(201);
    expect(created.body.toolchain).toHaveLength(1);
    expect(created.body.toolchain[0]).toMatchObject({ name: 'warmth', kind: 'prompt' });
  });

  it('refuses an unknown step id as a 400 that names the reason', async () => {
    const res = await agent
      .post('/api/profiles')
      .send({ name: 'bad-chain', toolchain: [{ id: 'a-downloaded-binary' }] })
      .expect(400);
    expect(res.body.message).toMatch(/unknown id/);
  });

  it('updates the chain, and an empty array resets to the default', async () => {
    const list = (await agent.get('/api/profiles').expect(200)).body as Array<{
      id: number;
      name: string;
      toolchain: unknown;
    }>;
    const target = list.find((p) => p.name === 'chain-tone');
    expect(target).toBeTruthy();

    const toggled = await agent
      .patch(`/api/profiles/${target!.id}`)
      .send({ toolchain: [{ id: 'remove-ai-marks', enabled: false }] })
      .expect(200);
    expect(toggled.body.toolchain[0]).toMatchObject({ id: 'remove-ai-marks', enabled: false });

    const reset = await agent
      .patch(`/api/profiles/${target!.id}`)
      .send({ toolchain: [] })
      .expect(200);
    expect(reset.body.toolchain).toBeNull();
  });

  it('accepts a profile-authored master last and refuses a second one', async () => {
    const created = await agent
      .post('/api/profiles')
      .send({
        name: 'own-master',
        toolchain: [
          { id: 'avoid-ai-writing' },
          { kind: 'master', name: 'mine', body: 'Compose it.' },
        ],
      })
      .expect(201);
    expect(created.body.toolchain[1]).toMatchObject({ kind: 'master', name: 'mine' });

    const two = await agent
      .post('/api/profiles')
      .send({
        name: 'two-masters',
        toolchain: [
          { kind: 'master', name: 'one', body: 'First.' },
          { kind: 'master', name: 'two', body: 'Second.' },
        ],
      })
      .expect(400);
    expect(two.body.message).toMatch(/only one master/);
  });

  it('refuses voice-tune anywhere but last', async () => {
    const res = await agent
      .post('/api/profiles')
      .send({
        name: 'master-first',
        toolchain: [{ id: 'voice-tune' }, { id: 'avoid-ai-writing' }],
      })
      .expect(400);
    expect(res.body.message).toMatch(/last/);
  });
});
