import { Injectable } from '@nestjs/common';
import { TrustedDevicesRepository, type TrustedDeviceRecord } from '@tilawa-admin/core';
import { FingerprintObj } from '@/auth/types/fingerprint.type';

/**
 * Ported from nextpalestine's `trusted-devices.service.ts`. Trust is what makes
 * the second sign-in on a device quiet: without it, `signinLocal` answers 430
 * and asks for a code.
 *
 * A fingerprint is an object and clients do not guarantee key order, so the
 * repository hashes a canonical (sorted-key) form: two structurally identical
 * fingerprints match even when the JSON was built differently.
 */
@Injectable()
export class TrustedDevicesService {
  constructor(private readonly devices: TrustedDevicesRepository) {}

  async getTrustedDevicesByUserId(userId: string | number): Promise<TrustedDeviceRecord[]> {
    return this.devices.listByUser(Number(userId));
  }

  async isDeviceTrusted(userId: string | number, fingerprint: FingerprintObj): Promise<boolean> {
    return this.devices.isTrusted(Number(userId), fingerprint);
  }

  async updateTrustedDeviceByFingerprint({
    user,
    fingerprint,
  }: {
    user: string | number;
    fingerprint: FingerprintObj;
  }): Promise<TrustedDeviceRecord> {
    return this.devices.add(Number(user), fingerprint);
  }

  /**
   * Upstream accepted a fingerprint alone, which is not a tenancy boundary —
   * one user could remove another's device. Callers must pass a userId.
   */
  async deleteByFingerprint({
    userId,
    fingerprint,
  }: {
    userId: string | number;
    fingerprint: FingerprintObj;
  }): Promise<boolean> {
    return this.devices.remove(Number(userId), fingerprint);
  }

  async isTrustedHash(userId: string | number, hash: string): Promise<boolean> {
    return this.devices.isTrustedHash(Number(userId), hash);
  }

  /** Used when a session is deleted: the row already carries the canonical hash. */
  async deleteByFingerprintHash(userId: string | number, hash: string): Promise<boolean> {
    return this.devices.removeByHash(Number(userId), hash);
  }

  async deleteManyByUserId(userId: string | number): Promise<number> {
    return this.devices.removeAllForUser(Number(userId));
  }

  async deleteExpired(): Promise<number> {
    return this.devices.removeExpired();
  }
}
