import { randomUUID } from 'node:crypto';
import type { Db } from './db';

/**
 * Submitted text, stored so a tool can accept `documentId` instead of a path
 * (`run_gate`, `generate_profile`).
 *
 * The id is opaque and random rather than sequential: it is handed to a client
 * and used in later calls, so a guessable id would be an enumeration oracle
 * across tenants even though every read is scoped by `user_id`.
 */
export interface DocumentRecord {
  id: string;
  user_id: number;
  text: string;
  created_at: string;
}

export class DocumentsRepository {
  constructor(private readonly db: Db) {}

  create(userId: number, text: string, id?: string): DocumentRecord {
    const documentId = id ?? `doc_${randomUUID().replace(/-/g, '')}`;
    this.db
      .prepare('INSERT INTO documents (id, user_id, text) VALUES (?, ?, ?)')
      .run(documentId, userId, text);
    return this.getById(documentId, userId) as DocumentRecord;
  }

  getById(id: string, userId: number): DocumentRecord | null {
    const row = this.db
      .prepare('SELECT * FROM documents WHERE id = ? AND user_id = ?')
      .get(id, userId) as DocumentRecord | undefined;
    return row ?? null;
  }

  listForUser(userId: number, limit = 50): { id: string; created_at: string; bytes: number }[] {
    return this.db
      .prepare(
        `SELECT id, created_at, LENGTH(text) AS bytes FROM documents
          WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
      )
      .all(userId, limit) as { id: string; created_at: string; bytes: number }[];
  }

  remove(id: string, userId: number): boolean {
    return (
      this.db.prepare('DELETE FROM documents WHERE id = ? AND user_id = ?').run(id, userId)
        .changes > 0
    );
  }
}
