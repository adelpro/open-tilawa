import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { linkProps } from '../lib/router';
import { bytes } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { Chip, Notice } from '../components/Chip';
import { Panel } from '../components/Panel';
import { SkeletonRows } from '../components/Skeleton';
import type { Seeder, SeederInventory } from '../lib/types-seeders';

/**
 * Torrents live on the seeders, not in this database: everything here is a
 * proxy to the selected node's admin API, so what the screen shows is what the
 * node actually holds — not a second, drifting catalogue.
 */
export function Torrents({ seederId: routeId }: { seederId?: string }): ReactElement {
  const { user } = useSession();
  const { t, locale } = useI18n();
  const [seeders, setSeeders] = useState<Seeder[] | null>(null);
  const [seederId, setSeederId] = useState<number | null>(null);
  const [inventory, setInventory] = useState<SeederInventory | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [mode, setMode] = useState<'magnet' | 'file'>('magnet');
  const [magnet, setMagnet] = useState('');
  const [torrentPath, setTorrentPath] = useState('');

  const loadSeeders = useCallback(async () => {
    try {
      const rows = await api<Seeder[]>('/seeders');
      setSeeders(rows);
      setSeederId(
        (current) => current ?? rows.find((s) => s.hasCredentials)?.id ?? rows[0]?.id ?? null,
      );
    } catch (caught) {
      setSeeders([]);
      setError(caught instanceof Error ? caught.message : t('torrents.loadFailed'));
    }
  }, [t, routeId]);

  const loadInventory = useCallback(
    async (id: number) => {
      setError(null);
      try {
        setInventory(await api<SeederInventory>(`/seeders/${id}/torrents`));
      } catch (caught) {
        setInventory(null);
        setError(caught instanceof Error ? caught.message : t('torrents.loadFailed'));
      }
    },
    [t],
  );

  const loadFiles = useCallback(async (id: number) => {
    try {
      setFiles((await api<{ files: string[] }>(`/seeders/${id}/files`)).files);
    } catch {
      setFiles([]);
    }
  }, []);

  useEffect(() => {
    void loadSeeders();
  }, [loadSeeders]);

  useEffect(() => {
    if (seederId === null) return;
    void loadInventory(seederId);
    void loadFiles(seederId);
  }, [seederId, loadInventory, loadFiles]);

  async function addTorrent(): Promise<void> {
    if (seederId === null) return;
    const body = mode === 'magnet' ? { magnet: magnet.trim() } : { torrentPath };
    if (mode === 'magnet' && !body.magnet) return;
    if (mode === 'file' && !torrentPath) return;
    setBusy('add');
    setError(null);
    try {
      const result = await api<{ name?: string }>(`/seeders/${seederId}/torrents`, {
        method: 'POST',
        body,
      });
      setMagnet('');
      setTorrentPath('');
      setShowAdd(false);
      setMessage(t('torrents.added', { name: result.name ?? '' }));
      await loadInventory(seederId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('torrents.addFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function removeTorrent(infoHash: string): Promise<void> {
    if (seederId === null) return;
    setBusy(`remove-${infoHash}`);
    setError(null);
    try {
      await api(`/seeders/${seederId}/torrents/${infoHash}`, { method: 'DELETE' });
      setMessage(t('torrents.removed'));
      await loadInventory(seederId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('torrents.removeFailed'));
    } finally {
      setBusy(null);
    }
  }

  if (!user) return <p className="body muted">{t('torrents.signInRequired')}</p>;

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          {routeId ? (
            <a className="fine-print" {...linkProps('/seeders')}>
              ← {t('torrents.backToSeeders')}
            </a>
          ) : null}
          <h1 className="display-lg">{t('torrents.title')}</h1>
          <p className="body muted">{t('torrents.lede')}</p>
        </div>
        <div className="cluster">
          <Button
            variant="secondary"
            onClick={() => seederId !== null && void loadInventory(seederId)}
            busy={busy === 'refresh'}
          >
            {t('torrents.refresh')}
          </Button>
          <Button
            onClick={() => {
              setShowAdd(!showAdd);
              if (seederId !== null) void loadFiles(seederId);
            }}
          >
            {showAdd ? t('torrents.cancel') : t('torrents.add')}
          </Button>
        </div>
      </header>

      {error ? <Notice tone="bad">{error}</Notice> : null}
      {message ? <Notice tone="ok">{message}</Notice> : null}

      {seeders !== null && seeders.length === 0 ? (
        <Panel>
          <p className="body muted">{t('torrents.noSeeders')}</p>
        </Panel>
      ) : null}

      {seeders !== null && seeders.length > 0 ? (
        <Panel>
          <Field label={t('torrents.node')} hint={t('torrents.nodeHint')}>
            {(id) => (
              <select
                id={id}
                className="field__select"
                value={seederId ?? ''}
                onChange={(event) => setSeederId(Number(event.target.value))}
              >
                {seeders.map((seeder) => (
                  <option key={seeder.id} value={seeder.id}>
                    {seeder.name} — {seeder.url}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </Panel>
      ) : null}

      {showAdd && seederId !== null ? (
        <Panel>
          <div className="stack">
            <div className="cluster" role="tablist" aria-label={t('torrents.addMode')}>
              <Button
                small
                variant={mode === 'magnet' ? 'primary' : 'secondary'}
                onClick={() => setMode('magnet')}
              >
                {t('torrents.magnet')}
              </Button>
              <Button
                small
                variant={mode === 'file' ? 'primary' : 'secondary'}
                onClick={() => setMode('file')}
              >
                {t('torrents.file')}
              </Button>
            </div>
            {mode === 'magnet' ? (
              <Field label={t('torrents.magnet')} hint={t('torrents.magnetHint')}>
                {(id) => (
                  <Input
                    id={id}
                    value={magnet}
                    onChange={(event) => setMagnet(event.target.value)}
                    placeholder="magnet:?xt=urn:btih:…"
                  />
                )}
              </Field>
            ) : (
              <Field label={t('torrents.file')} hint={t('torrents.fileHint')}>
                {(id) => (
                  <select
                    id={id}
                    className="field__select"
                    value={torrentPath}
                    onChange={(event) => setTorrentPath(event.target.value)}
                  >
                    <option value="">{t('torrents.filePlaceholder')}</option>
                    {files.map((file) => (
                      <option key={file} value={file}>
                        {file}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            )}
            <div className="cluster">
              <Button
                onClick={() => void addTorrent()}
                busy={busy === 'add'}
                disabled={mode === 'magnet' ? !magnet.trim() : !torrentPath}
              >
                {t('torrents.addSubmit')}
              </Button>
            </div>
          </div>
        </Panel>
      ) : null}

      {inventory === null ? (
        seederId === null ? null : (
          <SkeletonRows rows={3} label={t('torrents.loading')} />
        )
      ) : (
        <Panel>
          <p className="body muted">
            {t('torrents.summary', {
              count: String(inventory.stats.totalTorrents),
              peers: String(inventory.stats.totalPeers),
            })}
          </p>
          {inventory.torrents.length === 0 ? (
            <p className="body muted">{t('torrents.empty')}</p>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">{t('torrents.name')}</th>
                    <th scope="col">{t('torrents.size')}</th>
                    <th scope="col">{t('torrents.progress')}</th>
                    <th scope="col">{t('torrents.peers')}</th>
                    <th scope="col">{t('torrents.speed')}</th>
                    <th scope="col">{t('torrents.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.torrents.map((torrent) => (
                    <tr key={torrent.infoHash}>
                      <td>
                        <span className="row__label">{torrent.name}</span>
                        <br />
                        <span className="row__id">{torrent.infoHash}</span>
                      </td>
                      <td className="num">{bytes(torrent.size, locale)}</td>
                      <td>
                        <Chip tone={torrent.done ? 'ok' : 'notice'}>{torrent.progress}%</Chip>
                      </td>
                      <td className="num">{torrent.peers}</td>
                      <td className="num">
                        ↑ {bytes(torrent.uploadSpeed, locale, true)} · ↓{' '}
                        {bytes(torrent.downloadSpeed, locale, true)}
                      </td>
                      <td>
                        <span className="cluster cluster--end">
                          <Button
                            small
                            variant="destructive"
                            onClick={() => void removeTorrent(torrent.infoHash)}
                            busy={busy === `remove-${torrent.infoHash}`}
                          >
                            {t('torrents.remove')}
                          </Button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
