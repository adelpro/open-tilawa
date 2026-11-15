import { Injectable, NotFoundException } from '@nestjs/common';
import { readFile, readdir, stat } from 'node:fs/promises';
import type { Stats } from 'node:fs';
import { join } from 'node:path';

/**
 * The host job (`db-backup.sh`) writes `tilawa-admin-YYYYMMDDTHHMMSSZ.sqlite` and a
 * `status.json` beside it. Nothing else in that directory is ours: the filter is
 * here so a stray file cannot appear on the page or be downloaded.
 */
const FILE_PATTERN = /^tilawa-admin-\d{8}T\d{6}Z\.sqlite$/;

export interface BackupFile {
  name: string;
  bytes: number;
  mtime: string;
}

export interface BackupOverview {
  /** False when the directory is not mounted: the page says so instead of showing zero. */
  configured: boolean;
  directory: string;
  staleHours: number;
  stale: boolean;
  /** `unmounted`, `missing` (job never ran), `ok`, `pending`, `failed`. */
  state: 'unmounted' | 'missing' | 'ok' | 'pending' | 'failed';
  generatedAt: string | null;
  error: string | null;
  local: (BackupFile & { ageHours: number }) | null;
  remote: {
    state: string | null;
    lastOkAt: string | null;
    lastOkFile: string | null;
    ageHours: number | null;
  } | null;
  files: BackupFile[];
}

/**
 * Reads what the backup job already decided, and nothing more.
 *
 * The console does not take snapshots, prune them or push them — that is the host
 * timer's job, which owns the database, the lock and the ssh key. This service only
 * reports, because a control plane that can also fail silently is worse than a
 * read-only page that cannot.
 */
@Injectable()
export class BackupsService {
  private readonly directory = process.env.BACKUP_DIR ?? '/backups';
  private readonly staleHours = Number(process.env.BACKUP_STALE_HOURS ?? 26);

  async overview(): Promise<BackupOverview> {
    const files = await this.list();
    const status = await this.readStatus();

    if (files === null) {
      return {
        configured: false,
        directory: this.directory,
        staleHours: this.staleHours,
        stale: true,
        state: 'unmounted',
        generatedAt: null,
        error: null,
        local: null,
        remote: null,
        files: [],
      };
    }

    const newest = files[0] ?? null;
    const local = newest ? { ...newest, ageHours: ageHours(newest.mtime) } : null;

    const remoteAt = status?.remote?.last_ok_at ?? null;
    const remote = status?.remote
      ? {
          state: status.remote.state ?? null,
          lastOkAt: remoteAt,
          lastOkFile: status.remote.last_ok_file ?? null,
          ageHours: remoteAt ? ageHours(remoteAt) : null,
        }
      : null;

    // The verdict is the older of the two copies: a fresh file here that never
    // reached the node is exactly the case this page exists to catch.
    const ages = [local?.ageHours, remote?.ageHours].filter(
      (value): value is number => typeof value === 'number',
    );
    const oldest = ages.length ? Math.max(...ages) : Number.POSITIVE_INFINITY;
    // Two copies are expected (this host and the node); one is already a finding.
    const stale = ages.length < 2 || oldest > this.staleHours;

    return {
      configured: true,
      directory: this.directory,
      staleHours: this.staleHours,
      stale,
      state: stateOf(files, status),
      generatedAt: status?.generated_at ?? null,
      error: status?.error ?? null,
      local,
      remote,
      files,
    };
  }

  /**
   * The path of one snapshot, or a 404.
   *
   * The name is matched against the pattern rather than sanitised: an allow-list of
   * the shape we write cannot be talked into `../../etc/passwd`, and a snapshot that
   * is not on disk is a 404 rather than a different kind of error.
   */
  async pathFor(name: string): Promise<string> {
    if (!FILE_PATTERN.test(name)) throw new NotFoundException('No such snapshot');
    const path = join(this.directory, name);
    const exists = await stat(path).then(
      () => true,
      () => false,
    );
    if (!exists) throw new NotFoundException('No such snapshot');
    return path;
  }

  /** `null` means "the directory is not there", which is not the same as "empty". */
  private async list(): Promise<BackupFile[] | null> {
    let entries: string[];
    try {
      entries = await readdir(this.directory);
    } catch {
      return null;
    }

    const rows = await Promise.all(
      entries
        .filter((name) => FILE_PATTERN.test(name))
        .map(async (name): Promise<BackupFile | null> => {
          const info: Stats | null = await stat(join(this.directory, name)).catch(() => null);
          if (!info?.isFile()) return null;
          return { name, bytes: info.size, mtime: info.mtime.toISOString() };
        }),
    );

    // The name sorts chronologically, so this is newest first without trusting mtime
    // (a restored copy keeps the source's timestamp).
    return rows
      .filter((row): row is BackupFile => row !== null)
      .sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0));
  }

  private async readStatus(): Promise<StatusFile | null> {
    try {
      const raw = await readFile(join(this.directory, 'status.json'), 'utf8');
      return JSON.parse(raw) as StatusFile;
    } catch {
      return null;
    }
  }
}

interface StatusFile {
  generated_at?: string;
  status?: 'ok' | 'pending' | 'failed';
  error?: string | null;
  remote?: {
    state?: string | null;
    last_ok_at?: string | null;
    last_ok_file?: string | null;
  };
}

function ageHours(iso: string): number {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - then) / 3_600_000);
}

function stateOf(
  files: BackupFile[],
  status: StatusFile | null,
): 'unmounted' | 'missing' | 'ok' | 'pending' | 'failed' {
  if (files.length === 0 && !status) return 'missing';
  if (status?.status === 'failed') return 'failed';
  if (status?.status === 'pending') return 'pending';
  return 'ok';
}
