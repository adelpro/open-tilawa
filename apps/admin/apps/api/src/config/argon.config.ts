import { Algorithm } from '@node-rs/argon2';

/**
 * argon2id parameters for password hashing.
 *
 * Two defects in the ported original are fixed here:
 *
 * 1. `salt: crypto.randomBytes(16)` — one salt per process, shared by every
 *    hash, instead of argon2's per-hash random salt. Removed: the library now
 *    generates a salt per hash and embeds it in the output, so verification
 *    still works against existing hashes.
 * 2. The ported comment implied the cost multiplies by parallelism. It does
 *    not: `memoryCost` is the whole cost per hash, ~64 MiB here, which is why
 *    both containers run `mem_limit: 512m` (T1.6).
 *
 * `@node-rs/argon2` rather than the `argon2` npm package: prebuilt binaries
 * for Alpine/musl, so the runtime image needs no compiler. Same algorithm,
 * same hash format.
 */
export const argonConfig = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 65536, // 64 MiB per hash
  timeCost: 3,
  parallelism: 4,
  outputLen: 64,
};
