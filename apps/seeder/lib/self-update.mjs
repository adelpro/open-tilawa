/**
 * Letting a node update itself.
 *
 * The console can only *ask*: this module decides what the node will run, and
 * the request handler runs exactly that with no user input in the command. It is
 * off unless `SEEDER_SELF_UPDATE=1`, because the command needs the Docker socket
 * and that makes the node's admin password root on its host.
 *
 * Found in the 1.5.0 deploy: a node updates by pulling its own image and
 * recreating one service. Everything it holds lives in volumes, so a recreate
 * costs a few seconds of connections, not content.
 */

const DEFAULTS = {
  file: '/compose/docker-compose.yml',
  project: 'tilawa-seeder',
  service: 'seeder',
  timeoutMs: 600_000,
};

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ enabled: boolean, file: string, project: string, service: string, timeoutMs: number }}
 */
export function selfUpdateConfig(env = process.env) {
  const timeout = Number(env.SEEDER_UPDATE_TIMEOUT_MS);
  return {
    enabled: env.SEEDER_SELF_UPDATE === '1',
    file: env.SEEDER_COMPOSE_FILE || DEFAULTS.file,
    project: env.SEEDER_COMPOSE_PROJECT || DEFAULTS.project,
    service: env.SEEDER_SERVICE || DEFAULTS.service,
    // A pull that hangs must end in a reported failure, not a stuck request.
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? Math.floor(timeout) : DEFAULTS.timeoutMs,
  };
}

/**
 * The two commands, as argv arrays — never a shell string, so nothing from a
 * request can reach an interpreter.
 *
 * `-p` is not optional: the compose file is mounted at `/compose`, and without an
 * explicit project Compose would derive `compose` from the directory, create a
 * second stack, and collide with the running one on its published ports.
 *
 * `--no-deps` is deliberate too: updating the node must not restart whatever its
 * compose file declares as a dependency.
 */
export function composeSteps(config) {
  const base = ['compose', '-p', config.project, '-f', config.file];
  return [
    [...base, 'pull', config.service],
    [...base, 'up', '-d', '--no-deps', config.service],
  ];
}
