import type { Db } from './db';
import type { GateId } from '../engine/tools';

/**
 * One row per gate execution, so "why did this draft fail last Tuesday" is
 * answerable without re-running anything.
 *
 * The exit code is stored as the gate produced it — 0 clean, 1 violation, 2 tool
 * error — because that contract is the product's promise and flattening it here
 * would hide exactly the case that matters.
 */
export interface GateRunRecord {
  id: number;
  user_id: number;
  document_id: string | null;
  gate: GateId;
  code: number;
  hits_json: string | null;
  ms: number;
  created_at: string;
}

export interface RecordGateRunInput {
  userId: number;
  documentId?: string | null;
  gate: GateId;
  code: number;
  hits?: string[];
  ms: number;
}

export class GateRunsRepository {
  constructor(private readonly db: Db) {}

  record(input: RecordGateRunInput): number {
    const info = this.db
      .prepare(
        `INSERT INTO gate_runs (user_id, document_id, gate, code, hits_json, ms)
         VALUES (@user_id, @document_id, @gate, @code, @hits_json, @ms)`,
      )
      .run({
        user_id: input.userId,
        document_id: input.documentId ?? null,
        gate: input.gate,
        code: input.code,
        hits_json: input.hits && input.hits.length > 0 ? JSON.stringify(input.hits) : null,
        ms: input.ms,
      });
    return Number(info.lastInsertRowid);
  }

  recentForUser(userId: number, limit = 50): GateRunRecord[] {
    return this.db
      .prepare('SELECT * FROM gate_runs WHERE user_id = ? ORDER BY id DESC LIMIT ?')
      .all(userId, limit) as GateRunRecord[];
  }

  summaryForUser(userId: number): { gate: string; code: number; runs: number }[] {
    return this.db
      .prepare(
        `SELECT gate, code, COUNT(*) AS runs FROM gate_runs
          WHERE user_id = ? GROUP BY gate, code ORDER BY gate, code`,
      )
      .all(userId) as { gate: string; code: number; runs: number }[];
  }
}
