/**
 * Letting a node update itself.
 *
 * The console can only *ask*: this module decides what the node will run, and
 * the request handler runs exactly that with no user input in the command. It is
 * off unless `SEEDER_SELF_UPDATE=1`, because the command needs the Docker socket
 * and that makes the node's admin password root on its host.
 *
 * The work is done in a *sibling* container, not by the seeder's own CLI. That
 * is not a detail: `compose up` stops the container it is recreating, and a CLI
 * living inside that container is killed halfway through — the old container is
 * stopped and the new one is created but never started, which is exactly the
 * half-dead state the first live test produced. A detached helper is owned by
 * the daemon, so it outlives the container it replaces.
 */

const DEFAULTS = {
  /** Where the compose file lives inside the helper container. */
  file: '/compose/docker-compose.yml',
  /** Where it lives on the host — the source of the helper's bind mount. */
  hostFile: '/opt/tilawa-seeder/docker-compose.yml',
  project: 'tilawa-seeder',
  service: 'seeder',
  /** Multi-arch, public, and it only ever runs `compose`. */
  helperImage: 'docker:27-cli',
  timeoutMs: 600_000,
};

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function selfUpdateConfig(env = process.env) {
  const timeout = Number(env.SEEDER_UPDATE_TIMEOUT_MS);
  return {
    enabled: env.SEEDER_SELF_UPDATE === '1',
    file: env.SEEDER_COMPOSE_FILE || DEFAULTS.file,
    hostFile: env.SEEDER_COMPOSE_HOST_FILE || DEFAULTS.hostFile,
    project: env.SEEDER_COMPOSE_PROJECT || DEFAULTS.project,
    service: env.SEEDER_SERVICE || DEFAULTS.service,
    helperImage: env.SEEDER_HELPER_IMAGE || DEFAULTS.helperImage,
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
 * The first step runs in the foreground because a failed pull is the failure the
 * console can still report. The second is detached (`-d`), because it is the one
 * that stops this container; the helper keeps going without us.
 */
export function composeSteps(config) {
  const inner = ['compose', '-p', config.project, '-f', config.file];
  const helper = (detached) => [
    'run',
    '--rm',
    ...(detached ? ['-d'] : []),
    // The helper needs the daemon and the file that describes this node, and
    // nothing else from the seeder's own filesystem.
    '--entrypoint',
    'docker',
    '-v',
    '/var/run/docker.sock:/var/run/docker.sock',
    '-v',
    `${config.hostFile}:${config.file}:ro`,
    config.helperImage,
  ];
  return [
    [...helper(false), ...inner, 'pull', config.service],
    [...helper(true), ...inner, 'up', '-d', '--no-deps', config.service],
  ];
}
