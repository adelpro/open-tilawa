import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BackupsService, composeRestoreArgs, composeRunArgs } from '../src/backups/backups.service';

/**
 * The run command is the whole security story of this endpoint: it shells out with the
 * Docker socket behind it, so what reaches argv has to be fixed and nothing else may.
 */
describe('composeRunArgs', () => {
  it('names the compose file, the ops profile and the backup service', () => {
    expect(composeRunArgs('/host/docker-compose.yml')).toEqual([
      'compose',
      '-f',
      '/host/docker-compose.yml',
      '--profile',
      'ops',
      'run',
      '--rm',
      '--no-deps',
      'backup',
    ]);
  });

  it('removes the container when it exits, so a failed run leaves nothing behind', () => {
    expect(composeRunArgs('/host/docker-compose.yml')).toContain('--rm');
  });

  it('does not start dependencies: a backup must not restart the API it reads from', () => {
    expect(composeRunArgs('/host/docker-compose.yml')).toContain('--no-deps');
  });

  it('carries no shell metacharacters, so an argument cannot become a command', () => {
    for (const arg of composeRunArgs('/host/docker-compose.yml')) {
      expect(arg).not.toMatch(/[;&|`$()<>]/);
    }
  });
});

describe('composeRestoreArgs', () => {
  it('detaches, because it stops the process that asked for it', () => {
    expect(composeRestoreArgs('/host/docker-compose.yml', 'tilawa-admin-20260101T000000Z.sqlite'))
      .toContain('-d');
  });

  it('names the restore service and the exact snapshot', () => {
    const name = 'tilawa-admin-20260101T000000Z.sqlite';
    const args = composeRestoreArgs('/host/docker-compose.yml', name);
    expect(args.slice(-2)).toEqual(['restore', name]);
  });
});

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

  it('reports the retention rule recorded by the job', async () => {
    writeFileSync(
      join(dir, 'status.json'),
      JSON.stringify({
        status: 'ok',
        retention: { recentHours: 72, dailyDays: 30, maxFiles: 240 },
      }),
    );
    const overview = await new BackupsService().overview();
    expect(overview.retention).toEqual({ recentHours: 72, dailyDays: 30, maxFiles: 240 });
  });

  it('reports no retention when the status file predates the field', async () => {
    writeFileSync(join(dir, 'status.json'), JSON.stringify({ status: 'ok' }));
    const overview = await new BackupsService().overview();
    expect(overview.retention).toBeNull();
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
