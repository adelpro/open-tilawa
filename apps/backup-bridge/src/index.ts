import { readFileSync } from 'node:fs';

import { createBridgeServer } from './server.ts';
import { checkTarget, downloadFile } from './sftp.ts';

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string };

const port = Number(process.env.PORT ?? '9401');
const token = process.env.BRIDGE_TOKEN ?? '';
const allowedHosts = (process.env.SFTP_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);
const secretsDir = process.env.BRIDGE_SECRETS_DIR ?? '/secrets';

if (!token) {
  console.error('BRIDGE_TOKEN is required');
  process.exit(1);
}
if (allowedHosts.length === 0) {
  console.error('SFTP_ALLOWED_HOSTS is required');
  process.exit(1);
}

const server = createBridgeServer({
  secretsDir,
  token,
  allowedHosts,
  version: packageJson.version,
  check: checkTarget,
  download: downloadFile,
});

server.listen(port, '0.0.0.0', () => {
  console.log(`backup-bridge ${packageJson.version} listening on ${port}`);
});
