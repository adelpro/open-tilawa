import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { SQLITE_DB } from '@/store/store.module';
import type { Db } from '@tilawa-admin/core';

export type TempLinkPurpose = 'activation' | 'reset';

/**
 * The ledger behind single-use email links (migration 009; audit:
 * temp-link.replay-no-consumption-cross-flow).
 *
 * A link is still a short-lived JWT, but the JWT now carries a random `jti`
 * and the flow's purpose — and it is only worth anything while a row with
 * that jti exists with `consumed_at` still NULL. Issuance writes the row,
 * redemption flips it in one atomic statement (a second presentation of the
 * same link loses the race: `changes` is 0 and the link is dead), and a
 * password change or an activation landing deletes the account's
 * not-yet-consumed rows of that flow, killing every other outstanding link
 * the same minute the state they were minted for is gone.
 */
@Injectable()
export class TempLinksService {
  constructor(
    @Inject(SQLITE_DB) private readonly db: Db,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Shared verification for email-link tokens: signature and expiry first, then
   * the purpose MUST match the flow, and the jti must still name an outstanding
   * ledger row. Throws 401 on every failure shape — malformed, expired,
   * replayed, cross-flow, unknown jti — because distinguishing them only helps
   * whoever is probing.
   */
  async verify(
    token: string,
    purpose: TempLinkPurpose,
  ): Promise<{ id: number | string; email?: string; jti: string; fromId?: number; toId?: number }> {
    let decoded: {
      id?: number | string;
      email?: string;
      purpose?: string;
      jti?: string;
      fromId?: number;
      toId?: number;
    };
    try {
      decoded = await this.jwtService.verifyAsync(token, {
        secret: this.config.get<string>('TEMP_JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (!decoded?.id || decoded.purpose !== purpose || typeof decoded.jti !== 'string') {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (!this.doesJtiBelong(decoded.jti, purpose)) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return {
      id: decoded.id,
      email: decoded.email,
      jti: decoded.jti,
      fromId: decoded.fromId,
      toId: decoded.toId,
    };
  }

  /** Mint the identity and record the outstanding link. */
  issue(
    userId: number | string,
    purpose: TempLinkPurpose,
    ttlMs: number,
  ): {
    jti: string;
    expiresAt: Date;
  } {
    const jti = randomUUID();
    const expiresAt = new Date(Date.now() + ttlMs);
    this.db
      .prepare(
        `INSERT INTO temp_links (jti, user_id, purpose, expires_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(jti, Number(userId), purpose, expiresAt.toISOString());
    this.pruneExpired();
    return { jti, expiresAt };
  }

  /**
   * Redeem one link exactly once. The `consumed_at IS NULL` predicate inside
   * the UPDATE is the whole single-use guarantee: two callers racing on the
   * same jti serialise on SQLite's write lock and exactly one sees `changes`
   * = 1.
   */
  consume(jti: string, purpose: TempLinkPurpose): boolean {
    const result = this.db
      .prepare(
        `UPDATE temp_links SET consumed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
           WHERE jti = ? AND purpose = ? AND consumed_at IS NULL`,
      )
      .run(jti, purpose);
    return result.changes === 1;
  }

  /** Kill the account's unconsumed links of one flow (password change, activation). */
  purgeForUser(userId: number | string, purpose: TempLinkPurpose): void {
    this.db
      .prepare(`DELETE FROM temp_links WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL`)
      .run(Number(userId), purpose);
  }

  doesJtiBelong(jti: string, purpose: TempLinkPurpose): boolean {
    const row = this.db
      .prepare(`SELECT user_id FROM temp_links WHERE jti = ? AND purpose = ?`)
      .get(jti, purpose) as { user_id: number } | undefined;
    return !!row;
  }

  private pruneExpired(): void {
    this.db
      .prepare(`DELETE FROM temp_links WHERE expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ','now')`)
      .run();
  }
}
