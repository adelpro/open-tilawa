import { execFile } from 'node:child_process';

export interface SeederUpdateSettings {
  /** The compose file that owns the seeder service, on the mounted host tree. */
  composeFile: string;
  project: string;
  service: string;
  /** `build` compiles from the mounted source tree; `pull` fetches the image. */
  mode: 'build' | 'pull';
  timeoutMs: number;
}

export interface SeederUpdateResult {
  mode: 'build' | 'pull';
  output: string;
}

/**
 * The compose argv for one seeder update.
 *
 * Pure and exported so the exact command can be asserted without a Docker
 * daemon: `-p` pins the project name (the API container's working directory is
 * not the compose directory), `-f` names the file explicitly, and every
 * argument is fixed — no user input reaches the command line.
 */
export function composeArgs(
  settings: Pick<SeederUpdateSettings, 'composeFile' | 'project' | 'service' | 'mode'>,
): string[][] {
  const base = ['compose', '-p', settings.project, '-f', settings.composeFile];
  return [
    [...base, settings.mode === 'build' ? 'build' : 'pull', settings.service],
    [...base, 'up', '-d', '--no-deps', '--force-recreate', settings.service],
  ];
}

function run(args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'docker',
      args,
      { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          // The stderr tail is the part an operator can act on; the whole build
          // log would not fit in a JSON response anyway.
          const tail = `${stderr || stdout}`.trim().split('\n').slice(-12).join('\n');
          reject(new Error(tail || error.message));
          return;
        }
        resolve(stdout);
      },
    );
  });
}

/**
 * Update the seeder service through the host's Docker.
 *
 * The API container talks to the daemon over the mounted socket and to the
 * repository over a read-only mount; the operation is deliberately fixed to one
 * service. Whatever this returns is shown to an administrator, so it keeps the
 * last lines of output rather than a bare "done".
 */
export async function updateSeederService(
  settings: SeederUpdateSettings,
): Promise<SeederUpdateResult> {
  const [refresh, recreate] = composeArgs(settings);
  const lines: string[] = [];
  for (const args of [refresh, recreate]) {
    const out = await run(args, settings.timeoutMs);
    const tail = out.trim().split('\n').slice(-6).join('\n');
    if (tail) lines.push(tail);
  }
  return { mode: settings.mode, output: lines.join('\n') };
}
