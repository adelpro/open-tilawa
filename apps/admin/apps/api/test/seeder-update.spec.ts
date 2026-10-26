import { composeArgs } from '../src/seeders/seeder-update';

/**
 * The update command is asserted exactly: it runs against the host's Docker
 * daemon as root-equivalent, so "roughly the right command" is not good enough.
 */
describe('seeder update command', () => {
  const base = {
    composeFile: '/host/docker-compose.yml',
    project: 'open-tilawa',
    service: 'seeder',
  };

  it('builds from the mounted tree, then recreates only the seeder', () => {
    expect(composeArgs({ ...base, mode: 'build' })).toEqual([
      ['compose', '-p', 'open-tilawa', '-f', '/host/docker-compose.yml', 'build', 'seeder'],
      [
        'compose',
        '-p',
        'open-tilawa',
        '-f',
        '/host/docker-compose.yml',
        'up',
        '-d',
        '--no-deps',
        '--force-recreate',
        'seeder',
      ],
    ]);
  });

  it('pulls the registry image in a fleet deployment', () => {
    const [refresh] = composeArgs({ ...base, mode: 'pull' });
    expect(refresh.at(-2)).toBe('pull');
    expect(refresh.at(-1)).toBe('seeder');
  });
});
