import type { AlertKind } from './alert-kinds';

/**
 * Alert evaluation, as a pure function.
 *
 * The scheduler's only job is to assemble an `Observation` and hand it here.
 * That split is deliberate: every other test in this suite is a jest spec over a
 * pure unit, and alert logic that needed a live poller to exercise would be the
 * one part of the console nobody could test.
 */

export interface ObservedService {
  id: number;
  name: string;
  /** Newest first. */
  passed: boolean[];
}

export interface ObservedSeeder {
  id: number;
  name: string;
  status: 'online' | 'offline' | 'unknown';
  lastSeen: string | null;
  headroomBytes: number | null;
  updateError: string | null;
}

export interface Observation {
  now: Date;
  services: ObservedService[];
  seeders: ObservedSeeder[];
  open: { kind: AlertKind; subject: string }[];
  settings: {
    enabled: AlertKind[];
    serviceFailures: number;
    diskFloorBytes: number;
  };
}

export interface AlertEvent {
  action: 'open' | 'resolve';
  kind: AlertKind;
  subject: string;
  /** The resource's own name, so a mail can be written in the recipient's language. */
  name: string;
  /** English text for the console and the log; the mailer localises its own. */
  title: string;
  detail: string | null;
  /** Numbers the mail needs; `title`/`detail` are for humans reading English. */
  params?: {
    failures?: number;
    headroomBytes?: number;
    lastSeen?: string | null;
    error?: string | null;
  };
}

/** A node is not "offline" until it has missed the poll it would have answered. */
const OFFLINE_AFTER_MS = 15 * 60_000;

/** Two consecutive good checks clear a service; one good check is a blip. */
const RECOVERY_CHECKS = 2;

/** Above `floor * 1.1` the disk is genuinely better, not one deleted torrent better. */
const DISK_HYSTERESIS = 1.1;

function leading(passed: boolean[], value: boolean): number {
  let count = 0;
  for (const entry of passed) {
    if (entry !== value) break;
    count += 1;
  }
  return count;
}

function gigabytes(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export function evaluate(observation: Observation): AlertEvent[] {
  const { now, services, seeders, settings } = observation;
  const open = new Set(observation.open.map((entry) => `${entry.kind}|${entry.subject}`));
  const enabled = new Set(settings.enabled);
  const events: AlertEvent[] = [];

  const emit = (event: AlertEvent): void => {
    // Defence in depth: the rules below already consult `open`, but a caller that
    // passes a duplicate must not produce a second mail.
    if (enabled.has(event.kind)) events.push(event);
  };

  for (const service of services) {
    if (!enabled.has('service.down')) continue;
    const subject = `service:${service.id}`;
    const isOpen = open.has(`service.down|${subject}`);
    const failures = leading(service.passed, false);

    if (!isOpen && failures >= settings.serviceFailures) {
      emit({
        action: 'open',
        kind: 'service.down',
        subject,
        name: service.name,
        title: `Service down: ${service.name}`,
        detail: `${failures} consecutive checks failed`,
        params: { failures },
      });
    } else if (isOpen && leading(service.passed, true) >= RECOVERY_CHECKS) {
      emit({
        action: 'resolve',
        kind: 'service.down',
        subject,
        name: service.name,
        title: `Recovered: ${service.name}`,
        detail: null,
      });
    }
  }

  for (const seeder of seeders) {
    const subject = `seeder:${seeder.id}`;

    if (enabled.has('seeder.offline')) {
      const isOpen = open.has(`seeder.offline|${subject}`);
      const lastSeen = seeder.lastSeen ? Date.parse(seeder.lastSeen) : null;
      const stale = lastSeen === null || Number.isNaN(lastSeen) || now.getTime() - lastSeen >= OFFLINE_AFTER_MS;

      if (!isOpen && seeder.status === 'offline' && stale) {
        emit({
          action: 'open',
          kind: 'seeder.offline',
          subject,
          name: seeder.name,
          title: `Node offline: ${seeder.name}`,
          detail: seeder.lastSeen ? `Last seen ${seeder.lastSeen}` : 'Never seen',
          params: { lastSeen: seeder.lastSeen },
        });
      } else if (isOpen && seeder.status === 'online') {
        emit({
          action: 'resolve',
          kind: 'seeder.offline',
          subject,
          name: seeder.name,
          title: `Node back online: ${seeder.name}`,
          detail: null,
        });
      }
    }

    if (enabled.has('seeder.disk') && seeder.headroomBytes !== null) {
      const isOpen = open.has(`seeder.disk|${subject}`);
      const floor = settings.diskFloorBytes;

      if (!isOpen && seeder.headroomBytes < floor) {
        emit({
          action: 'open',
          kind: 'seeder.disk',
          subject,
          name: seeder.name,
          title: `Disk low: ${seeder.name}`,
          detail: `${gigabytes(seeder.headroomBytes)} of headroom (floor ${gigabytes(floor)})`,
          params: { headroomBytes: seeder.headroomBytes },
        });
      } else if (isOpen && seeder.headroomBytes > floor * DISK_HYSTERESIS) {
        emit({
          action: 'resolve',
          kind: 'seeder.disk',
          subject,
          name: seeder.name,
          title: `Disk recovered: ${seeder.name}`,
          detail: gigabytes(seeder.headroomBytes),
          params: { headroomBytes: seeder.headroomBytes },
        });
      }
    }

    if (enabled.has('seeder.update_failed')) {
      const isOpen = open.has(`seeder.update_failed|${subject}`);

      if (!isOpen && seeder.updateError) {
        emit({
          action: 'open',
          kind: 'seeder.update_failed',
          subject,
          name: seeder.name,
          title: `Update failed: ${seeder.name}`,
          detail: seeder.updateError,
          params: { error: seeder.updateError },
        });
      } else if (isOpen && !seeder.updateError) {
        emit({
          action: 'resolve',
          kind: 'seeder.update_failed',
          subject,
          name: seeder.name,
          title: `Update recovered: ${seeder.name}`,
          detail: null,
        });
      }
    }
  }

  // Deterministic order: a test and a log should read the same twice.
  return events.sort((a, b) =>
    a.kind === b.kind ? a.subject.localeCompare(b.subject) : a.kind.localeCompare(b.kind),
  );
}
