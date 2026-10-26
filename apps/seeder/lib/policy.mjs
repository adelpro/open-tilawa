/**
 * Disk policy for a seeder node.
 *
 * Two separate ideas, deliberately not conflated:
 * - `quota` is the operator's promise to the host: never hold more than this.
 * - `free` is what the filesystem says right now; it can shrink under us.
 * A node is full when either bound is reached, and the answer names which.
 */

/** Bytes from `DISK_QUOTA_GB` (decimal-friendly) or `MAX_DISK_BYTES`; 0 = unlimited. */
export function quotaFromEnv(env = process.env) {
  const bytes = Number(env.MAX_DISK_BYTES);
  if (Number.isFinite(bytes) && bytes > 0) return Math.floor(bytes);
  const gb = Number(env.DISK_QUOTA_GB);
  if (Number.isFinite(gb) && gb > 0) return Math.floor(gb * 1024 ** 3);
  return 0;
}

/**
 * @param {object} input
 * @param {number} input.quotaBytes   0 when unlimited
 * @param {number} input.usedBytes    sum of the lengths of everything held
 * @param {number} input.incomingBytes the release being added (0 when unknown)
 * @param {number} [input.freeBytes]  filesystem free space, when known
 * @param {number} [input.reserveBytes] keep this much free regardless
 */
export function fits({ quotaBytes, usedBytes, incomingBytes, freeBytes, reserveBytes = 0 }) {
  const incoming = Number.isFinite(incomingBytes) && incomingBytes > 0 ? incomingBytes : 0;
  const used = Number.isFinite(usedBytes) && usedBytes > 0 ? usedBytes : 0;
  const headroomByQuota = quotaBytes > 0 ? Math.max(0, quotaBytes - used) : Infinity;
  const headroomByDisk =
    Number.isFinite(freeBytes) && freeBytes >= 0 ? Math.max(0, freeBytes - reserveBytes) : Infinity;
  const headroomBytes = Math.min(headroomByQuota, headroomByDisk);

  if (incoming <= headroomBytes) {
    return { ok: true, reason: null, headroomBytes };
  }
  const reason = headroomByQuota <= headroomByDisk ? 'quota' : 'disk';
  return { ok: false, reason, headroomBytes };
}

/** `xl` is the exact length a magnet may carry; it is a hint, never trusted alone. */
export function exactLengthFromMagnet(magnet) {
  try {
    const xl = new URL(magnet).searchParams.get('xl');
    const value = Number(xl);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}
