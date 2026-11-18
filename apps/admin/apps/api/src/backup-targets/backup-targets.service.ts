import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import {
  AuditRepository,
  BackupTargetsRepository,
  UsersRepository,
  type BackupTarget,
} from '@tilawa-admin/core';

import { BridgeClient, type BridgeFile } from './bridge.client';
import type { CreateBackupTargetDTO, UpdateBackupTargetDTO } from './backup-targets.dto';

const SNAPSHOT_PATTERN = /^tilawa-admin-\d{8}T\d{6}Z\.sqlite$/;

export type BackupTargetView = BackupTarget;

@Injectable()
export class BackupTargetsService {
  constructor(
    private readonly repo: BackupTargetsRepository,
    private readonly bridge: BridgeClient,
    private readonly users: UsersRepository,
    private readonly audit: AuditRepository,
    @Optional() private readonly allowedHosts: string = process.env.SFTP_ALLOWED_HOSTS ?? '',
  ) {}

  list(): BackupTarget[] {
    return this.repo.list();
  }

  async create(input: CreateBackupTargetDTO, actorId: number): Promise<BackupTarget> {
    this.assertHost(input.host);
    const now = new Date().toISOString();
    const target: BackupTarget = {
      id: randomUUID(),
      label: input.label.trim(),
      host: input.host.trim().toLowerCase(),
      port: input.port,
      username: input.username.trim(),
      remoteDir: input.remoteDir.trim(),
      enabled: input.enabled ?? true,
      lastState: null,
      lastCheckedAt: null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    };
    this.repo.upsert(target);
    this.record(actorId, 'backup.target.create', target.id);
    return target;
  }

  async update(
    id: string,
    input: UpdateBackupTargetDTO,
    actorId: number,
  ): Promise<BackupTarget> {
    const existing = this.require(id);
    this.assertHost(input.host);
    const target: BackupTarget = {
      ...existing,
      label: input.label.trim(),
      host: input.host.trim().toLowerCase(),
      port: input.port,
      username: input.username.trim(),
      remoteDir: input.remoteDir.trim(),
      enabled: input.enabled ?? existing.enabled,
      updatedAt: new Date().toISOString(),
    };
    this.repo.upsert(target);
    this.record(actorId, 'backup.target.update', id);
    return target;
  }

  async remove(id: string, actorId: number): Promise<void> {
    this.assertOwner(actorId);
    this.require(id);
    this.repo.remove(id);
    this.record(actorId, 'backup.target.remove', id);
  }

  async saveCredential(
    id: string,
    credential: { password?: string; privateKey?: string },
    actorId: number,
  ): Promise<{ saved: true }> {
    this.assertOwner(actorId);
    this.require(id);
    if (!credential.password && !credential.privateKey) {
      throw new BadRequestException('password or privateKey is required');
    }
    const result = await this.bridge.putCredential(id, credential);
    this.record(actorId, 'backup.target.credential', id);
    return result;
  }

  async check(id: string, actorId: number): Promise<BackupTarget> {
    const target = this.require(id);
    const result = await this.bridge.check(target);
    this.repo.setHealth(
      id,
      result.ok ? 'ok' : 'failed',
      new Date().toISOString(),
      result.ok ? null : (result.error ?? 'check failed'),
    );
    this.record(actorId, 'backup.target.check', id);
    return this.require(id);
  }

  files(id: string): Promise<BridgeFile[]> {
    return this.bridge.files(this.require(id));
  }

  async download(id: string, name: string): Promise<Buffer> {
    if (!SNAPSHOT_PATTERN.test(name)) throw new BadRequestException('snapshot name is invalid');
    return this.bridge.download(this.require(id), name);
  }

  private require(id: string): BackupTarget {
    const target = this.repo.get(id);
    if (!target) throw new NotFoundException('no such target');
    return target;
  }

  private assertHost(host: string): void {
    const allowed = this.allowedHosts
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
    if (!allowed.includes(host.trim().toLowerCase())) {
      throw new BadRequestException('host is not allowed');
    }
  }

  private assertOwner(actorId: number): void {
    const owner = this.users.getOwner();
    if (!owner || owner.id !== actorId) throw new ForbiddenException('owner only');
  }

  private record(actorId: number, action: string, target: string): void {
    this.audit.record({ actorId, action, target, status: 'ok' });
  }
}
