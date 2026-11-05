import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PEER_PORT_COMMAND, installCommand } from '../src/constants/seeder.ts';

test('the install command is the one the console prints', () => {
  assert.equal(
    installCommand({ diskGb: 50, uploadKbps: 20000 }),
    'curl -fsSL https://raw.githubusercontent.com/adelpro/open-tilawa/main/deploy-node.sh | sudo bash -s -- --type seeder --disk 50 --upload-kbps 20000',
  );
});

test('the peer port is the only one opened', () => {
  assert.equal(PEER_PORT_COMMAND, 'sudo ufw allow 6881/tcp && sudo ufw allow 6881/udp');
  assert.doesNotMatch(PEER_PORT_COMMAND, /8085/);
});

test('bad limits are refused rather than printed', () => {
  assert.throws(() => installCommand({ diskGb: 0, uploadKbps: 20000 }));
  assert.throws(() => installCommand({ diskGb: 50, uploadKbps: -1 }));
  assert.throws(() => installCommand({ diskGb: 1.5, uploadKbps: 20000 }));
});
