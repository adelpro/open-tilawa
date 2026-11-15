import { composeRestoreArgs, composeRunArgs } from '../src/backups/backups.service';

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
