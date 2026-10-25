import type { Db } from './db';

/**
 * Learned preferences — upstream's `learned-preferences.json`, one row per note
 * so the dashboard can delete one at a time.
 *
 * Every method takes the owning `userId` as well as the profile id: a profile id
 * is guessable (it is an autoincrement integer), so it cannot be the tenancy
 * boundary on its own.
 */
export interface PreferenceRecord {
  id: number;
  profile_id: number;
  text: string;
  source: string | null;
  created_at: string;
}

export class PreferencesRepository {
  constructor(private readonly db: Db) {}

  add(
    profileId: number,
    userId: number,
    text: string,
    source: string | null = null,
  ): PreferenceRecord | null {
    const owned = this.db
      .prepare('SELECT id FROM profiles WHERE id = ? AND user_id = ?')
      .get(profileId, userId);
    if (!owned) return null;

    const info = this.db
      .prepare('INSERT INTO preferences (profile_id, text, source) VALUES (?, ?, ?)')
      .run(profileId, text, source);
    return this.getById(Number(info.lastInsertRowid), userId);
  }

  getById(id: number, userId: number): PreferenceRecord | null {
    const row = this.db
      .prepare(
        `SELECT p.* FROM preferences p
           JOIN profiles pr ON pr.id = p.profile_id
          WHERE p.id = ? AND pr.user_id = ?`,
      )
      .get(id, userId) as PreferenceRecord | undefined;
    return row ?? null;
  }

  listForProfile(profileId: number, userId: number): PreferenceRecord[] {
    return this.db
      .prepare(
        `SELECT p.* FROM preferences p
           JOIN profiles pr ON pr.id = p.profile_id
          WHERE p.profile_id = ? AND pr.user_id = ?
          ORDER BY p.id ASC`,
      )
      .all(profileId, userId) as PreferenceRecord[];
  }

  /** Just the text, in the order upstream appended it. */
  textsForProfile(profileId: number, userId: number): string[] {
    return this.listForProfile(profileId, userId).map((row) => row.text);
  }

  remove(id: number, userId: number): boolean {
    return (
      this.db
        .prepare(
          `DELETE FROM preferences
            WHERE id = ?
              AND profile_id IN (SELECT id FROM profiles WHERE user_id = ?)`,
        )
        .run(id, userId).changes > 0
    );
  }

  removeAllForProfile(profileId: number, userId: number): number {
    return this.db
      .prepare(
        `DELETE FROM preferences
          WHERE profile_id = ?
            AND profile_id IN (SELECT id FROM profiles WHERE user_id = ?)`,
      )
      .run(profileId, userId).changes;
  }
}
