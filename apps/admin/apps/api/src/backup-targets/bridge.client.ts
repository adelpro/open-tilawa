import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { BackupTarget } from '@tilawa-admin/core';

export type BridgeFile = { name: string; size: number; mtime: string };
export type BridgeCheck = { ok: boolean; count: number; files: BridgeFile[]; error?: string };

/**
 * The only caller of the bridge. The token is read from the environment and
 * never leaves this process; no route returns it.
 */
@Injectable()
export class BridgeClient {
  private readonly base: string;
  private readonly token: string;

  constructor(config: ConfigService) {
    this.base = (config.get<string>('BRIDGE_URL') ?? 'http://backup-bridge:9401').replace(/\/$/, '');
    this.token = config.get<string>('BRIDGE_TOKEN') ?? '';
  }

  private query(target: BackupTarget): string {
    const params = new URLSearchParams({
      host: target.host,
      port: String(target.port),
      username: target.username,
      remoteDir: target.remoteDir,
    });
    return params.toString();
  }

  private async call(path: string, init: RequestInit = {}): Promise<Response> {
    const response = await fetch(`${this.base}${path}`, {
      ...init,
      headers: { 'x-bridge-token': this.token, ...(init.headers ?? {}) },
      // Pharmacyserver's SSH handshake has measured 9-59 s; the bridge owns the
      // 90 s connect deadline, so this is only the outer ceiling.
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `bridge answered ${response.status}`);
    }
    return response;
  }

  async putCredential(id: string, credential: { password?: string; privateKey?: string }): Promise<{ saved: true }> {
    const response = await this.call(`/targets/${id}/credentials`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(credential),
    });
    return (await response.json()) as { saved: true };
  }

  async check(target: BackupTarget): Promise<BridgeCheck> {
    const response = await this.call(`/targets/${target.id}/health?${this.query(target)}`);
    return (await response.json()) as BridgeCheck;
  }

  async files(target: BackupTarget): Promise<BridgeFile[]> {
    const response = await this.call(`/targets/${target.id}/files?${this.query(target)}`);
    const body = (await response.json()) as { files?: BridgeFile[] };
    return body.files ?? [];
  }

  async download(target: BackupTarget, name: string): Promise<Buffer> {
    const response = await this.call(
      `/targets/${target.id}/files/${encodeURIComponent(name)}?${this.query(target)}`,
    );
    return Buffer.from(await response.arrayBuffer());
  }
}
