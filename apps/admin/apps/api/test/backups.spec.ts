import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BackupsService } from '../src/backups/backups.service';

describe('backups overview', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tilawa-backups-'));
    writeFileSync(join(dir, 'tilawa-admin-20261101T000000Z.sqlite'), 'snapshot');
    process.env.BACKUP_DIR = dir;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    delete process.env.BACKUP_DIR;
  });

  it('reports the verified far copy from status.json', async () => {
    writeFileSync(
      join(dir, 'status.json'),
      JSON.stringify({
        status: 'ok',
        remote: {
          state: 'ok',
          last_ok_at: '2026-11-01T00:00:00.000Z',
          last_ok_file: 'tilawa-admin-20261101T000000Z.sqlite',
          verified_at: '2026-11-01T00:05:00.000Z',
          verified_error: null,
        },
      }),
    );

    const overview = await new BackupsService().overview();
    expect(overview.remote?.verifiedAt).toBe('2026-11-01T00:05:00.000Z');
    expect(overview.remote?.verifiedError).toBeNull();
  });

  it('reports a failed far-copy verification', async () => {
    writeFileSync(
      join(dir, 'status.json'),
      JSON.stringify({
        status: 'ok',
        remote: {
          state: 'ok',
          last_ok_at: '2026-11-01T00:00:00.000Z',
          verified_error: 'integrity_check failed',
        },
      }),
    );

    const overview = await new BackupsService().overview();
    expect(overview.remote?.verifiedError).toBe('integrity_check failed');
    expect(overview.remote?.verifiedAt).toBeNull();
  });
});
