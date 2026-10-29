import { Inject, Injectable, Logger } from '@nestjs/common';
import { SQLITE_DB } from '@/store/store.module';
import type { Db } from '@tilawa-admin/core';
import { MailerService } from '@/mailer/mailer.service';
import type { MailRecipient } from '@/mailer/mailer.service';
import { SettingsService } from '@/settings/settings.service';
import type { AlertKind } from './alert-kinds';
import { escapeHtml } from './escape';
import { describeAlert } from './messages';
import type { AlertEvent } from './notifications.rules';

export interface AlertRow {
  id: number;
  kind: AlertKind;
  subject: string;
  title: string;
  detail: string | null;
  state: 'open' | 'resolved';
  openedAt: string;
  notifiedAt: string | null;
  notifyError: string | null;
  resolvedAt: string | null;
  resolvedNotifiedAt: string | null;
}

interface AlertRecord {
  id: number;
  kind: AlertKind;
  subject: string;
  title: string;
  detail: string | null;
  state: 'open' | 'resolved';
  opened_at: string;
  notified_at: string | null;
  notify_error: string | null;
  resolved_at: string | null;
  resolved_notified_at: string | null;
}

/** A resolve mail about an outage this short is noise, not news. */
const MIN_OPEN_MS = 10 * 60_000;

/** After a resolve, the same subject stays quiet for an hour. */
const REOPEN_COOLDOWN_MS = 60 * 60_000;

/**
 * Stored stamps are ISO-8601 with `Z` (the column default). `Date.parse` treats a
 * missing zone as *local* time, which turned a four-minute-old alert into a
 * two-hour-old one under a non-UTC clock — so a stamp without a zone is read as
 * UTC explicitly rather than trusted to the parser.
 */
function at(stamp: string): number {
  const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/.test(stamp) ? stamp : `${stamp.replace(' ', 'T')}Z`;
  const parsed = Date.parse(zoned);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

/**
 * Alert persistence, and the only place that decides whether a transition is
 * worth an email.
 *
 * The schema does the dedupe — a partial unique index makes "one open alert per
 * (kind, subject)" a constraint rather than a check someone can forget. Two API
 * processes share this database, so the insert is `OR IGNORE` and a no-op is a
 * normal outcome, not an error.
 */
@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @Inject(SQLITE_DB) private readonly db: Db,
    private readonly settings: SettingsService,
    private readonly mailer: MailerService,
  ) {}

  openKeys(): { kind: AlertKind; subject: string }[] {
    return this.db
      .prepare("SELECT kind, subject FROM alerts WHERE state = 'open'")
      .all() as { kind: AlertKind; subject: string }[];
  }

  recent(limit = 20): AlertRow[] {
    const rows = this.db
      .prepare('SELECT * FROM alerts ORDER BY id DESC LIMIT ?')
      .all(limit) as AlertRecord[];
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      subject: row.subject,
      title: row.title,
      detail: row.detail,
      state: row.state,
      openedAt: row.opened_at,
      notifiedAt: row.notified_at,
      notifyError: row.notify_error,
      resolvedAt: row.resolved_at,
      resolvedNotifiedAt: row.resolved_notified_at,
    }));
  }

  async apply(events: AlertEvent[]): Promise<void> {
    for (const event of events) {
      if (event.action === 'open') await this.open(event);
      else await this.resolve(event);
    }
  }

  private async open(event: AlertEvent): Promise<void> {
    const info = this.db
      .prepare('INSERT OR IGNORE INTO alerts (kind, subject, title, detail) VALUES (?, ?, ?, ?)')
      .run(event.kind, event.subject, event.title, event.detail);

    // `changes === 0` means another process (or an earlier pass) already opened it.
    if (info.changes === 0) return;

    const row = this.db
      .prepare('SELECT * FROM alerts WHERE kind = ? AND subject = ? AND state = ?')
      .get(event.kind, event.subject, 'open') as AlertRecord;

    if (this.recentlyResolved(event.kind, event.subject)) {
      this.logger.debug(`suppressing reopen mail for ${event.subject} (cooldown)`);
      return;
    }
    await this.deliver(row, event, 'open');
  }

  private async resolve(event: AlertEvent): Promise<void> {
    const row = this.db
      .prepare('SELECT * FROM alerts WHERE kind = ? AND subject = ? AND state = ?')
      .get(event.kind, event.subject, 'open') as AlertRecord | undefined;
    if (!row) return;

    const resolvedAt = new Date().toISOString();
    this.db
      .prepare("UPDATE alerts SET state = 'resolved', resolved_at = ? WHERE id = ?")
      .run(resolvedAt, row.id);

    if (Date.now() - at(row.opened_at) < MIN_OPEN_MS) return;
    await this.deliver({ ...row, state: 'resolved', resolved_at: resolvedAt }, event, 'resolve');
  }

  private recentlyResolved(kind: AlertKind, subject: string): boolean {
    const previous = this.db
      .prepare(
        `SELECT resolved_notified_at FROM alerts
          WHERE kind = ? AND subject = ? AND state = 'resolved' AND resolved_notified_at IS NOT NULL
          ORDER BY id DESC LIMIT 1`,
      )
      .get(kind, subject) as { resolved_notified_at: string } | undefined;
    if (!previous) return false;
    return Date.now() - at(previous.resolved_notified_at) < REOPEN_COOLDOWN_MS;
  }

  private async deliver(row: AlertRecord, event: AlertEvent, action: 'open' | 'resolve'): Promise<void> {
    const recipients = this.recipients();
    if (recipients.length === 0) {
      this.logger.warn(`alert ${row.kind} ${row.subject} fired with no active admin to tell`);
      return;
    }

    let delivered = 0;
    let lastError: string | null = null;

    for (const recipient of recipients) {
      const words = describeAlert(event, recipient.locale === 'ar' ? 'ar' : 'en');
      try {
        await this.mailer.sendAlertEmail(recipient, {
          subject: words.subject,
          heading: words.heading,
          resource: escapeHtml(event.name),
          detail: escapeHtml(words.detail),
          openedAt: row.opened_at,
        });
        delivered += 1;
      } catch (error) {
        lastError = (error as Error).message;
        this.logger.error(
          `alert mail to ${recipient.email} failed: ${lastError}`,
        );
      }
    }

    // The row survives a broken mailer on purpose: the panel must still show that
    // the alert fired, and why the mail did not arrive.
    if (delivered > 0) {
      const column = action === 'open' ? 'notified_at' : 'resolved_notified_at';
      this.db
        .prepare(`UPDATE alerts SET ${column} = ?, notify_error = NULL WHERE id = ?`)
        .run(new Date().toISOString(), row.id);
    } else {
      this.db
        .prepare('UPDATE alerts SET notify_error = ? WHERE id = ?')
        .run(lastError ?? 'no recipient accepted the message', row.id);
    }
  }

  /** Every active admin, plus the operator's extra addresses. */
  private recipients(): MailRecipient[] {
    const admins = this.db
      .prepare(
        "SELECT id, name, email, locale FROM users WHERE role IN ('admin','super_admin') AND status = 'active'",
      )
      .all() as { id: number; name: string; email: string; locale: string | null }[];

    const extra = this.settings.getNotifySettings().extraRecipients;

    return [
      ...admins.map((admin) => ({
        id: admin.id,
        name: admin.name,
        email: admin.email,
        locale: admin.locale === 'ar' ? ('ar' as const) : ('en' as const),
      })),
      ...extra.map((email) => ({ id: email, name: email, email, locale: 'en' as const })),
    ];
  }
}
