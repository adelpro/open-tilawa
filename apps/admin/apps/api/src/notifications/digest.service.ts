import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@/mailer/mailer.service';
import { SeedersService } from '@/seeders/seeders.service';
import { SettingsService } from '@/settings/settings.service';
import { StatusService } from '@/status/status.service';
import { TurnsService } from '@/turns/turns.service';
import { AlertsService } from './alerts.service';
import { escapeHtml } from './escape';

interface Row {
  label: string;
  value: string;
  ok: boolean;
}

export interface DigestReport {
  rows: Row[];
  broken: number;
}

/**
 * The daily status mail.
 *
 * It reads what the pollers already wrote — the same three sources the alert
 * rules read — and turns them into one table. Nothing here measures anything
 * new: a status mail that probed the stack itself would be a second monitor
 * disagreeing with the first.
 */
@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(
    private readonly status: StatusService,
    private readonly seeders: SeedersService,
    private readonly turns: TurnsService,
    private readonly settings: SettingsService,
    private readonly alerts: AlertsService,
    private readonly mailer: MailerService,
  ) {}

  /** What the mail would say, without sending it. */
  report(): DigestReport {
    const rows: Row[] = [];

    for (const service of this.status.overview()) {
      const uptime =
        service.uptime24h === null ? 'no data' : `${Math.round(service.uptime24h * 100)}% / 24h`;
      rows.push({
        label: service.name,
        value:
          service.ok === null
            ? `not checked — ${uptime}`
            : `${service.ok ? 'up' : 'down'} · ${uptime}${service.latencyMs === null ? '' : ` · ${service.latencyMs} ms`}`,
        ok: service.ok !== false,
      });
    }

    for (const node of this.seeders.list()) {
      const disk =
        node.headroomBytes === null
          ? ''
          : ` · ${(node.headroomBytes / 1024 ** 3).toFixed(1)} GB free`;
      const version = node.version ? ` · ${node.version}` : '';
      rows.push({
        label: `Node ${node.name}`,
        value: `${node.status} · ${node.torrentCount} torrents${version}${disk}`,
        ok: node.status !== 'offline',
      });
    }

    for (const turn of this.turns.list()) {
      rows.push({
        label: `TURN ${turn.name}`,
        value: `${turn.status}${turn.latencyMs === null ? '' : ` · ${turn.latencyMs} ms`}`,
        ok: turn.status !== 'offline',
      });
    }

    return { rows, broken: rows.filter((row) => !row.ok).length };
  }

  /**
   * Sends the day's mail to every active admin and marks the day. Returns the
   * number of recipients that accepted it.
   */
  async send(day: string): Promise<number> {
    const recipients = this.alerts.recipients();
    if (recipients.length === 0) {
      this.logger.warn('daily status mail has no active admin to send to');
      return 0;
    }

    const report = this.report();
    const open = this.alerts.recent(200).filter((alert) => alert.state === 'open').length;
    let delivered = 0;

    for (const recipient of recipients) {
      const arabic = recipient.locale === 'ar';
      try {
        await this.mailer.sendDigestEmail(recipient, {
          degraded: report.broken > 0,
          broken: report.broken,
          open,
          rows: report.rows
            .map(
              (row) =>
                `<tr><td style="padding:6px 0;color:#6e6e73">${escapeHtml(row.label)}</td><td style="padding:6px 0;text-align:${arabic ? 'left' : 'right'};font-weight:600">${escapeHtml(row.value)}</td></tr>`,
            )
            .join(''),
        });
        delivered += 1;
      } catch (error) {
        this.logger.error(
          `daily status mail to ${recipient.email} failed: ${(error as Error).message}`,
        );
      }
    }

    if (delivered > 0) this.settings.markDigestSent(day);
    return delivered;
  }

  /** True when the configured hour has arrived and today's mail is not out yet. */
  due(now: Date): { due: boolean; day: string } {
    const digest = this.settings.getNotifyDigest();
    const day = now.toISOString().slice(0, 10);
    const sent = this.settings.digestLastSent();
    return {
      due: digest.enabled && now.getUTCHours() === digest.hourUtc && sent !== day,
      day,
    };
  }
}
