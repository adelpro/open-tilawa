import { execFile } from 'node:child_process';

/**
 * Rebuilding the public site from the console.
 *
 * The API container talks to the host daemon over the mounted socket and to the
 * repository over a read-only mount, exactly as `seeder-update.ts` does. The
 * service is fixed to `web` and no request input reaches the command line. The
 * build reads the host tree, so a dirty `apps/web` would ship code nobody
 * reviewed; `dirtyTreeFiles()` is the gate that refuses it.
 */

export interface SiteRebuildSettings {
  /** The compose file that owns the web service, on the mounted host tree. */
  composeFile: string;
  project: string;
  service: string;
  timeoutMs: number;
}

/**
 * The two commands: build the image from the mounted tree, then recreate only
 * the web container. `--no-deps` matters — a plain `up` would touch the tracker
 * and relay because they are declared dependencies of something else in the
 * project.
 */
export function siteComposeArgs(
  settings: Pick<SiteRebuildSettings, 'composeFile' | 'project' | 'service'>,
): string[][] {
  const base = ['compose', '-p', settings.project, '-f', settings.composeFile];
  return [
    [...base, 'build', settings.service],
    [...base, 'up', '-d', '--no-deps', '--force-recreate', settings.service],
  ];
}

/**
 * The clean-tree check, scoped to what the web image actually reads.
 *
 * `apps/admin` is outside the Docker build context (`.dockerignore`), so console
 * work in progress must not block a site rebuild. `--no-optional-locks` keeps
 * `git status` from trying to refresh the index on a read-only mount.
 */
export function treeCheckArgs(): string[] {
  return [
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
  ];
}

function run(
  command: string,
  args: string[],
  timeoutMs: number,
  env?: NodeJS.ProcessEnv,
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, env }, (error, stdout, stderr) => {
      if (error) {
        // The stderr tail is the part an operator can act on; the whole build
        // log would not fit in a JSON response anyway.
        const tail = `${stderr || stdout}`.trim().split('\n').slice(-12).join('\n');
        reject(new Error(tail || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}

/** The files that would ride into the image if the build ran now. */
export async function dirtyTreeFiles(timeoutMs = 10_000): Promise<string[]> {
  const out = await run('git', treeCheckArgs(), timeoutMs, {
    ...process.env,
    GIT_OPTIONAL_LOCKS: '0',
  });
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Build and recreate the web service.
 *
 * The build does not stop this container; only the second command replaces the
 * web one. Output is kept to the last lines per step because the caller shows it
 * to an administrator.
 */
export async function rebuildSiteService(settings: SiteRebuildSettings): Promise<string> {
  const lines: string[] = [];
  for (const args of siteComposeArgs(settings)) {
    const out = await run('docker', args, settings.timeoutMs);
    const tail = out.trim().split('\n').slice(-6).join('\n');
    if (tail) lines.push(tail);
  }
  return lines.join('\n');
}
