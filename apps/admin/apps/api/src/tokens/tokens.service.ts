import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionsRepository, type SessionRecord } from '@tilawa-admin/core';
import { FingerprintObj } from '@/auth/types/fingerprint.type';

/**
 * Ported from nextpalestine's `tokens.service.ts`, where the semantics read
 * "one token per device fingerprint".
 *
 * The hash changed, deliberately. Upstream hashed the token with argon2 and
 * then looked the row up *by that hash* — which cannot work, because argon2 is
 * salted per hash: the same token hashes differently on every call. It only
 * appeared to work because `argonConfig` pinned one salt per process, so
 * lookups matched within a process lifetime and every session died on restart.
 * Session lookup needs a deterministic hash, so this uses sha256; argon2 stays
 * where it belongs, on passwords.
 */
@Injectable()
export class TokensService {
  constructor(
    private readonly sessions: SessionsRepository,
    private readonly config: ConfigService,
  ) {}

  private get ttlMs(): number {
    return Number(this.config.get<string>('COOKIE_JWT_TTL_MS') ?? 604_800_000);
  }

  async updateTokenByFingerprint(
    user: string | number,
    fingerprint: FingerprintObj,
    token: string,
  ): Promise<SessionRecord> {
    return this.sessions.upsertByFingerprint({
      userId: Number(user),
      token,
      fingerprint: fingerprint as Record<string, unknown>,
      ttlMs: this.ttlMs,
    });
  }

  async deleteTokenByFingerprint(
    id: string | number,
    fingerprint: FingerprintObj,
  ): Promise<boolean> {
    return this.sessions.deleteByFingerprint(Number(id), fingerprint as Record<string, unknown>);
  }

  /** Used by the JWT strategy: a token is only accepted while its row lives. */
  async findTokenByValue(token: string): Promise<SessionRecord | null> {
    return this.sessions.findLiveByToken(token);
  }

  async deleteTokenByValue(token: string): Promise<void> {
    this.sessions.deleteByToken(token);
  }

  async getTokenByFingerprint(
    id: string | number,
    fingerprint: FingerprintObj,
  ): Promise<string | null> {
    const row = this.sessions.getByFingerprint(Number(id), fingerprint as Record<string, unknown>);
    return row?.token_hash ?? null;
  }

  async getTokensByUserId(userId: string | number): Promise<SessionRecord[]> {
    return this.sessions.listByUser(Number(userId));
  }

  async deleteTokenById(id: string | number): Promise<boolean> {
    return this.sessions.deleteById(Number(id));
  }

  /** Revokes every device a user holds — used on disable, demotion and account deletion. */
  async deleteAllForUser(userId: string | number): Promise<number> {
    return this.sessions.deleteByUser(Number(userId));
  }

  async deleteExpired(): Promise<number> {
    return this.sessions.deleteExpired();
  }
}
