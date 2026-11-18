import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { BackupTargetsService } from './backup-targets.service';
import type { BackupTarget } from '@tilawa-admin/core';

function fakeRepo() {
  const rows = new Map<string, BackupTarget>();
  return {
    rows,
    list: () => [...rows.values()],
    get: (id: string) => rows.get(id) ?? null,
    upsert: (target: BackupTarget) => rows.set(target.id, target),
    setHealth: (id: string, state: string, at: string, error: string | null) => {
      const row = rows.get(id);
      if (row) rows.set(id, { ...row, lastState: state, lastCheckedAt: at, lastError: error });
    },
    remove: (id: string) => rows.delete(id),
  };
}

function fakeBridge() {
  const calls: string[] = [];
  return {
    calls,
    putCredential: async (id: string) => {
      calls.push(`cred:${id}`);
      return { saved: true as const };
    },
    check: async () => {
      calls.push('check');
      return { ok: true, count: 1, files: [{ name: 'tilawa-admin-20261101T000000Z.sqlite', size: 1, mtime: '2026-11-01T00:00:00.000Z' }] };
    },
    files: async () => {
      calls.push('files');
      return [{ name: 'tilawa-admin-20261101T000000Z.sqlite', size: 1, mtime: '2026-11-01T00:00:00.000Z' }];
    },
    download: async (_t: unknown, _c: unknown, name: string) => {
      calls.push(`download:${name}`);
      return Buffer.from('x');
    },
  };
}

function serviceWith(ownerId = 1) {
  const repo = fakeRepo();
  const bridge = fakeBridge();
  const users = { getOwner: () => ({ id: ownerId }) };
  const service = new BackupTargetsService(
    repo as never,
    bridge as never,
    users as never,
    { record: () => 1 } as never,
    'pharmacyserver',
  );
  return { repo, bridge, service };
}

const input = {
  label: 'Pharmacy',
  host: 'pharmacyserver',
  port: 22,
  username: 'adelpro',
  remoteDir: 'tilawa-backups',
};

describe('BackupTargetsService', () => {
  it('refuses a host outside the allow-list', async () => {
    const { service } = serviceWith();
    await expect(service.create(inputWith({ host: 'evil.example' }), 1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('saves a credential without returning it', async () => {
    const { service } = serviceWith();
    const created = await service.create(input, 1);
    const result = await service.saveCredential(created.id, { password: 'hunter2' }, 1);
    expect(result).toEqual({ saved: true });
    expect(JSON.stringify(result).includes('hunter2')).toBe(false);
  });

  it('persists the health result of a check', async () => {
    const { service, repo } = serviceWith();
    const created = await service.create(input, 1);
    const checked = await service.check(created.id, 1);
    expect(checked.lastState).toBe('ok');
    expect(repo.get(created.id)?.lastCheckedAt).toBeTruthy();
  });

  it('refuses an unknown snapshot name before calling the bridge', async () => {
    const { service, bridge } = serviceWith();
    const created = await service.create(input, 1);
    await expect(service.download(created.id, '../x.sqlite')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(bridge.calls.some((call) => call.startsWith('download:'))).toBe(false);
  });

  it('lets only the owner replace a credential or remove a target', async () => {
    const { service } = serviceWith(1);
    const created = await service.create(input, 1);
    await expect(
      service.saveCredential(created.id, { password: 'p' }, 2),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.remove(created.id, 2)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.remove(created.id, 1)).resolves.toBeUndefined();
  });
});

function inputWith(patch: Partial<typeof input>) {
  return { ...input, ...patch };
}
