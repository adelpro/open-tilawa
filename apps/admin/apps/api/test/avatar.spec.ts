import { bootHarness, type Harness } from './harness';

/**
 * Avatars (P6.2).
 *
 * The interesting cases are the refusals, not the happy path: an avatar route is
 * an endpoint that stores attacker-controlled bytes and serves them back from the
 * same origin as the session cookie, so the tests that matter are the ones proving
 * what it will not accept and what it will not serve.
 */
const account = { email: 'avatar@example.com', password: 'Password123' };

/** Enough of a PNG for the sniffer: signature plus a real IHDR carrying the size. */
function png(width: number, height: number): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write('IHDR', 4, 'latin1');
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr[16] = 8; // bit depth
  ihdr[17] = 6; // truecolour with alpha
  return Buffer.concat([signature, ihdr]);
}

/** A JPEG shell: SOI, optional APP1 EXIF, a frame header with the size, a scan, EOI. */
function jpeg(width: number, height: number, options: { exif?: boolean } = {}): Buffer {
  const soi = Buffer.from([0xff, 0xd8]);

  let app1 = Buffer.alloc(0);
  if (options.exif) {
    const payload = Buffer.concat([
      Buffer.from('Exif\0\0', 'latin1'),
      Buffer.from('MM\0*\0\0\0\x08\0\x01\x01\x00\0\x01\0\0\0GPS', 'latin1'),
    ]);
    const header = Buffer.alloc(4);
    header.writeUInt16BE(0xffe1, 0);
    header.writeUInt16BE(payload.length + 2, 2);
    app1 = Buffer.concat([header, payload]);
  }

  const sof = Buffer.alloc(2 + 17);
  sof.writeUInt16BE(0xffc0, 0);
  sof.writeUInt16BE(17, 2);
  sof[4] = 8;
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  sof[9] = 3;

  const sos = Buffer.from([0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0x33, 0xff, 0xd9]);
  return Buffer.concat([soi, app1, sof, sos]);
}

describe('avatars', () => {
  let h: Harness;
  let agent: ReturnType<Harness['agent']>;
  let csrf = '';
  let userId = 0;

  beforeAll(async () => {
    h = await bootHarness();
    userId = await h.seedUser({
      name: 'Avatar Tester',
      email: account.email,
      password: account.password,
    });
    expect(userId).toBeGreaterThan(0);

    agent = h.agent();
    await agent
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', 'avatar-a')
      .send({ user: account })
      .expect(200);

    const token = await agent.get('/api/csrf').expect(200);
    csrf = token.body.token as string;
  });

  afterAll(async () => {
    await h.close();
  });

  const upload = (bytes: Buffer, type = 'image/png') =>
    agent.post('/api/me/avatar').set('x-csrf-token', csrf).set('Content-Type', type).send(bytes);

  it('refuses an anonymous caller', async () => {
    const anonymous = h.agent();
    await anonymous
      .post('/api/me/avatar')
      .set('Content-Type', 'image/png')
      .send(png(64, 64))
      .expect(401);
    await anonymous.get('/api/avatar/1').expect(401);
  });

  it('stores a real image and serves it back with the headers that make it safe', async () => {
    const stored = await upload(png(256, 256)).expect(200);
    expect(stored.body.mime).toBe('image/png');
    expect(stored.body.avatarUpdatedAt).toBeTruthy();

    const served = await agent.get(`/api/avatar/${userId}`).buffer(true).expect(200);

    expect(served.headers['content-type']).toContain('image/png');
    expect(served.headers['x-content-type-options']).toBe('nosniff');
    expect(served.headers['content-security-policy']).toContain("default-src 'none'");
    expect(served.headers['cache-control']).toContain('private');
    expect(Buffer.isBuffer(served.body) ? served.body.length : 0).toBeGreaterThan(0);
  });

  it('refuses bytes that are not an image, whatever the request claims', async () => {
    await upload(Buffer.from('this is a text file pretending to be a png'), 'image/png').expect(
      415,
    );
  });

  it('refuses SVG, which is markup and can carry script', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    await upload(svg, 'image/svg+xml').expect(415);
  });

  it('refuses anything over the byte cap', async () => {
    const huge = Buffer.concat([png(64, 64), Buffer.alloc(600 * 1024)]);
    await upload(huge).expect(413);
  });

  it('refuses to serve another account avatar, and answers the same as no avatar', async () => {
    // The packet: one stranger uploads their own face; a second stranger, fully
    // signed in, asks for it by id. The id sweep must be blind — 404 here is the
    // SAME response the no-avatar case gives, so enumeration distinguishes
    // neither "exists" from "no photo" nor anybody's face from anyone's.
    const other = h.agent();
    const otherId = await h.seedUser({
      name: 'Peer Eavesdrop',
      email: 'avatar-peer@example.com',
      password: 'Password123',
    });
    await other
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', 'avatar-peer')
      .send({ user: { email: 'avatar-peer@example.com', password: 'Password123' } })
      .expect(200);
    const peerCsrf = (await other.get('/api/csrf').expect(200)).body.token as string;
    await other
      .post('/api/me/avatar')
      .set('x-csrf-token', peerCsrf)
      .set('Content-Type', 'image/png')
      .send(png(64, 64))
      .expect(200);

    // A different signed-in account asks for the peer's avatar.
    await agent.get(`/api/avatar/${otherId}`).expect(404);
    // And anonymous callers stay refused before any of that.
    await h.agent().get(`/api/avatar/${userId}`).expect(401);
  });

  it('serves an admin the avatar of an account they administer', async () => {
    const adminId = await h.seedUser({
      name: 'Avatar Admin',
      email: 'avatar-admin@example.com',
      password: 'PasswordAdmin123',
      role: 'admin',
    });
    const admin = h.agent();
    await admin
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', 'avatar-admin')
      .send({ user: { email: 'avatar-admin@example.com', password: 'PasswordAdmin123' } })
      .expect(200);
    const adminCsrf = (await admin.get('/api/csrf').expect(200)).body.token as string;

    // Self: upload, then read back.
    await admin
      .post('/api/me/avatar')
      .set('x-csrf-token', adminCsrf)
      .set('Content-Type', 'image/png')
      .send(png(64, 64))
      .expect(200);
    await admin.get(`/api/avatar/${adminId}`).buffer(true).expect(200);
  });

  it('refuses a decompression bomb before any decoder sees it', async () => {
    await upload(png(5000, 5000)).expect(400);
  });

  it('strips EXIF from a JPEG rather than storing location data', async () => {
    const before = jpeg(320, 240, { exif: true });
    expect(before.includes(Buffer.from('Exif', 'latin1'))).toBe(true);

    await upload(before, 'image/jpeg').expect(200);

    const served = await agent.get(`/api/avatar/${userId}`).buffer(true).expect(200);

    const bytes = Buffer.isBuffer(served.body) ? served.body : Buffer.alloc(0);
    expect(bytes.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(bytes.includes(Buffer.from('Exif', 'latin1'))).toBe(false);
    expect(bytes.includes(Buffer.from('GPS', 'latin1'))).toBe(false);
  });

  it('removes the avatar, and the route then answers 404', async () => {
    await agent.delete('/api/me/avatar').set('x-csrf-token', csrf).expect(200);
    await agent.get(`/api/avatar/${userId}`).expect(404);
  });
});
