import { describe, expect, it } from '@jest/globals';
import { siteComposeArgs, treeCheckArgs } from '../src/reciters/site-rebuild';

/**
 * These commands run against the host's Docker daemon through a root-equivalent
 * socket, so they are asserted exactly. The service is fixed to `web`; nothing
 * from a request reaches the command line.
 */
describe('site rebuild command', () => {
  const base = {
    composeFile: '/host/docker-compose.yml',
    project: 'open-tilawa',
    service: 'web',
  };

  it('builds the web image from the mounted tree, then recreates only web', () => {
    expect(siteComposeArgs(base)).toEqual([
      ['compose', '-p', 'open-tilawa', '-f', '/host/docker-compose.yml', 'build', 'web'],
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
        'web',
      ],
    ]);
  });

  it('checks only the tree the web build reads', () => {
    expect(treeCheckArgs()).toEqual([
      '-c',
      'safe.directory=/host',
      '-C',
      '/host',
      '--no-optional-locks',
      'status',
      '--porcelain',
      '--',
      'apps/web',
      'docker-compose.yml',
    ]);
  });
});
