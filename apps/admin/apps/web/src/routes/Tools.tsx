import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useSession } from '../lib/session';
import { bytes } from '../lib/format';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { Chip, Notice } from '../components/Chip';
import { Panel } from '../components/Panel';
import { CopyLine } from '../components/CopyLine';
import type { Seeder } from '../lib/types-seeders';

interface TorrentInfo {
  name: string;
  infoHash: string;
  magnet: string;
  size: number;
  files: number;
  trackers: string[];
}

/**
 * Conversions around a release: a .torrent file to its infohash and magnet, and
 * a magnet back to its name, size and file count.
 *
 * The second direction needs a seeder: metadata lives in the swarm, so a node is
 * the only party that can answer without downloading the payload — the endpoint
 * it calls resolves and destroys the torrent.
 */
export function Tools(): ReactElement {
  const { user } = useSession();
  const { t, locale } = useI18n();
  const [seeders, setSeeders] = useState<Seeder[] | null>(null);
  const [seederId, setSeederId] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [torrent, setTorrent] = useState<TorrentInfo | null>(null);
  const [magnet, setMagnet] = useState('');
  const [resolved, setResolved] = useState<TorrentInfo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSeeders = useCallback(async () => {
    try {
      const rows = await api<Seeder[]>('/seeders');
      setSeeders(rows);
      setSeederId(
        (current) => current ?? rows.find((row) => row.hasCredentials)?.id ?? rows[0]?.id ?? null,
      );
    } catch {
      setSeeders([]);
    }
  }, []);

  useEffect(() => {
    void loadSeeders();
  }, [loadSeeders]);

  async function readTorrent(): Promise<void> {
    if (!file) return;
    setBusy('file');
    setError(null);
    try {
      setTorrent(
        await api<TorrentInfo>('/tools/torrent-info', {
          method: 'POST',
          body: { fileBase64: await toBase64(file) },
        }),
      );
    } catch (caught) {
      setTorrent(null);
      setError(caught instanceof Error ? caught.message : t('tools.fileFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function resolveMagnet(): Promise<void> {
    if (seederId === null) return;
    setBusy('magnet');
    setError(null);
    try {
      setResolved(
        await api<TorrentInfo>('/tools/magnet-info', {
          method: 'POST',
          body: { seederId, magnet: magnet.trim() },
        }),
      );
    } catch (caught) {
      setResolved(null);
      setError(caught instanceof Error ? caught.message : t('tools.magnetFailed'));
    } finally {
      setBusy(null);
    }
  }

  if (!user) return <p className="body muted">{t('tools.signInRequired')}</p>;

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <h1 className="display-lg">{t('tools.title')}</h1>
          <p className="body muted">{t('tools.lede')}</p>
        </div>
      </header>

      {error ? <Notice tone="bad">{error}</Notice> : null}

      <Panel>
        <h2 className="group-title">{t('tools.torrentTitle')}</h2>
        <p className="body muted">{t('tools.torrentBody')}</p>
        <div className="stack">
          <Field label={t('tools.pickFile')} hint={t('tools.pickFileHint')}>
            {(id) => (
              <input
                id={id}
                type="file"
                accept=".torrent,application/x-bittorrent"
                className="field__input"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            )}
          </Field>
          <div className="cluster">
            <Button onClick={() => void readTorrent()} busy={busy === 'file'} disabled={!file}>
              {t('tools.read')}
            </Button>
          </div>

          {torrent ? (
            <div className="stack stack--tight">
              <p className="body">
                <strong>{torrent.name}</strong> · {bytes(torrent.size, locale)} ·{' '}
                {t('tools.files', { count: String(torrent.files) })}
              </p>
              <p className="row__id">{torrent.infoHash}</p>
              <CopyLine value={torrent.magnet} label={t('help.copy')} />
            </div>
          ) : null}
        </div>
      </Panel>

      <Panel>
        <h2 className="group-title">{t('tools.magnetTitle')}</h2>
        <p className="body muted">{t('tools.magnetBody')}</p>
        <div className="stack">
          <Field label={t('torrents.node')} hint={t('tools.nodeHint')}>
            {(id) => (
              <select
                id={id}
                className="field__select"
                value={seederId ?? ''}
                onChange={(event) => setSeederId(Number(event.target.value))}
              >
                {(seeders ?? []).map((seeder) => (
                  <option key={seeder.id} value={seeder.id}>
                    {seeder.name} — {seeder.url}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t('torrents.magnet')}>
            {(id) => (
              <Input
                id={id}
                value={magnet}
                onChange={(event) => setMagnet(event.target.value)}
                placeholder="magnet:?xt=urn:btih:…"
              />
            )}
          </Field>
          <div className="cluster">
            <Button
              onClick={() => void resolveMagnet()}
              busy={busy === 'magnet'}
              disabled={!magnet.trim() || seederId === null}
            >
              {t('tools.resolve')}
            </Button>
            {magnet.trim() ? <Chip tone="notice">{t('tools.usesNode')}</Chip> : null}
          </div>

          {resolved ? (
            <div className="stack stack--tight">
              <p className="body">
                <strong>{resolved.name}</strong> · {bytes(resolved.size, locale)} ·{' '}
                {t('tools.files', { count: String(resolved.files) })}
              </p>
              <p className="row__id">{resolved.infoHash}</p>
              <CopyLine value={resolved.magnet} label={t('help.copy')} />
            </div>
          ) : null}
          {seeders !== null && seeders.length === 0 ? (
            <p className="fine-print">{t('tools.noNodes')}</p>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}

async function toBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}
