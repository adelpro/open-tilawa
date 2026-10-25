import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * The sessions contract.
 *
 * `/tokens` serialises `createdAt`; the account screen must read the same name.
 * The original mismatch made every row fall back to `relative(undefined)` and
 * print “never”, including the session making the request.
 */
const ROOT = new URL('../src/', import.meta.url).pathname;
const read = (path) => readFileSync(join(ROOT, path), 'utf-8');

const types = read('lib/types.ts');
const account = read('routes/Account.tsx');
const apiDto = readFileSync(
  join(ROOT, '..', '..', 'api', 'src', 'tokens', 'dtos', 'myTokensResponseDTO.dto.ts'),
  'utf-8',
);

describe('signed-in devices', () => {
  it('reads the creation timestamp the API actually returns', () => {
    assert.match(apiDto, /this\.createdAt = session\.created_at/);
    assert.match(types, /export interface Session\s*\{[\s\S]*?createdAt\?: string/);
    assert.match(account, /relative\(session\.createdAt/);
  });
});
