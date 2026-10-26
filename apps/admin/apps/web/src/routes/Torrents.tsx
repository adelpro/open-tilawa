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
import { Modal } from '../components/Modal';
import type { Seeder, SeederInventory } from '../lib/types-seeders';

interface Reciter {
  id: number;
  name: string;
  riwaya: string;
  infohash: string;
  magnet: string;
  fileCount: number;
  sizeBytes: number | null;
}

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
  const [catalogue, setCatalogue] = useState<Reciter[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [catalogueBusy, setCatalogueBusy] = useState<string | null>(null);
  const [confirmUntracked, setConfirmUntracked] = useState(false);

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

  const loadCatalogue = useCallback(async () => {
    try {
      setCatalogue(await api<Reciter[]>('/reciters'));
    } catch {
      setCatalogue([]);
    }
  }, []);

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
    void loadCatalogue();
  }, [seederId, loadInventory, loadFiles, loadCatalogue]);

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

  async function addPicked(): Promise<void> {
    if (seederId === null || !catalogue) return;
    setCatalogueBusy('add');
    setError(null);
    try {
      for (const infohash of picked) {
        const reciter = catalogue.find((row) => row.infohash === infohash);
        if (!reciter) continue;
        await api(`/seeders/${seederId}/torrents`, {
          method: 'POST',
          body: { magnet: reciter.magnet || `magnet:?xt=urn:btih:${reciter.infohash}` },
        });
      }
      setPicked([]);
      setMessage(t('torrents.catalogueAdded', { count: String(picked.length) }));
      await loadInventory(seederId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('torrents.addFailed'));
    } finally {
      setCatalogueBusy(null);
    }
  }

  async function importCatalogue(): Promise<void> {
    if (seederId === null) return;
    setCatalogueBusy('import');
    setError(null);
    try {
      const result = await api<{ added: number; sized: number }>('/reciters/import', {
        method: 'POST',
        body: { seederId },
      });
      setMessage(t('torrents.importDone', { added: String(result.added) }));
      await loadCatalogue();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('torrents.importFailed'));
    } finally {
      setCatalogueBusy(null);
    }
  }

  const heldHashes = new Set(
    (inventory?.torrents ?? []).map((torrent) => torrent.infoHash.toLowerCase()),
  );
  const catalogueHashes = new Set((catalogue ?? []).map((row) => row.infohash.toLowerCase()));
  const missing = (catalogue ?? []).filter((row) => !heldHashes.has(row.infohash.toLowerCase()));
  const untracked = (inventory?.torrents ?? []).filter(
    (torrent) => !catalogueHashes.has(torrent.infoHash.toLowerCase()),
  );
  const pickedSize = (catalogue ?? [])
    .filter((row) => picked.includes(row.infohash))
    .reduce((sum, row) => sum + (row.sizeBytes ?? 0), 0);
  const selectedNode = seeders?.find((row) => row.id === seederId) ?? null;
  // The node's headroom is the number the add must respect: it already combines
  // its quota with the filesystem, and the node enforces the same rule again.
  const nodeHeadroom = selectedNode?.headroomBytes ?? selectedNode?.freeBytes ?? null;

  useEffect(() => {
    if (!catalogue || !inventory) return;
    const held = new Set(inventory.torrents.map((torrent) => torrent.infoHash.toLowerCase()));
    setPicked(
      catalogue.filter((row) => !held.has(row.infohash.toLowerCase())).map((row) => row.infohash),
    );
  }, [catalogue, inventory]);

  async function removeUntracked(): Promise<void> {
    if (seederId === null) return;
    setConfirmUntracked(false);
    setCatalogueBusy('purge');
    setError(null);
    try {
      for (const torrent of untracked) {
        await api(`/seeders/${seederId}/torrents/${torrent.infoHash}`, { method: 'DELETE' });
      }
      setMessage(t('torrents.untrackedRemoved', { count: String(untracked.length) }));
      await loadInventory(seederId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('torrents.removeFailed'));
    } finally {
      setCatalogueBusy(null);
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
          <div className="spread" style={{ marginBottom: 'var(--space-3)' }}>
            <p className="body muted">
              {t('torrents.summary', {
                count: String(inventory.stats.totalTorrents),
                peers: String(inventory.stats.totalPeers),
              })}
            </p>
            {untracked.length > 0 ? (
              <Button
                small
                variant="destructive"
                onClick={() => setConfirmUntracked(true)}
                busy={catalogueBusy === 'purge'}
              >
                {t('torrents.removeUntracked', { count: String(untracked.length) })}
              </Button>
            ) : null}
          </div>
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
                    <th scope="col">{t('torrents.source')}</th>
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
                        <Chip
                          tone={
                            catalogueHashes.has(torrent.infoHash.toLowerCase()) ? 'ok' : 'notice'
                          }
                        >
                          {t(
                            catalogueHashes.has(torrent.infoHash.toLowerCase())
                              ? 'torrents.inCatalogue'
                              : 'torrents.untracked',
                          )}
                        </Chip>
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
      {seederId !== null && catalogue ? (
        <Panel>
          <div className="spread" style={{ marginBottom: 'var(--space-3)' }}>
            <div>
              <h2 className="group-title">{t('torrents.catalogue')}</h2>
              <p className="body muted">{t('torrents.catalogueHint')}</p>
            </div>
            <Button
              variant="tertiary"
              onClick={() => void importCatalogue()}
              busy={catalogueBusy === 'import'}
            >
              {t('torrents.importCatalogue')}
            </Button>
          </div>

          {catalogue.length === 0 ? (
            <p className="body muted">{t('torrents.catalogueEmpty')}</p>
          ) : missing.length === 0 ? (
            <p className="body muted">{t('torrents.catalogueComplete')}</p>
          ) : (
            <div className="stack">
              <div className="cluster">
                <Button
                  small
                  variant="tertiary"
                  onClick={() => setPicked(missing.map((row) => row.infohash))}
                >
                  {t('torrents.selectAll')}
                </Button>
                <Button small variant="tertiary" onClick={() => setPicked([])}>
                  {t('torrents.selectNone')}
                </Button>
              </div>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">{t('torrents.pick')}</th>
                      <th scope="col">{t('torrents.name')}</th>
                      <th scope="col">{t('reciters.riwaya')}</th>
                      <th scope="col">{t('torrents.size')}</th>
                      <th scope="col">{t('torrents.state')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalogue.map((row) => {
                      const onNode = heldHashes.has(row.infohash.toLowerCase());
                      return (
                        <tr key={row.id}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={row.name}
                              disabled={onNode}
                              checked={onNode || picked.includes(row.infohash)}
                              onChange={(event) =>
                                setPicked((current) =>
                                  event.target.checked
                                    ? [...current, row.infohash]
                                    : current.filter((hash) => hash !== row.infohash),
                                )
                              }
                            />
                          </td>
                          <td>
                            <span className="row__label">{row.name}</span>
                            <br />
                            <span className="row__id">{row.infohash.slice(0, 16)}…</span>
                          </td>
                          <td>{row.riwaya}</td>
                          <td className="num">{bytes(row.sizeBytes, locale)}</td>
                          <td>
                            <Chip tone={onNode ? 'ok' : 'notice'}>
                              {t(onNode ? 'torrents.onNode' : 'torrents.offNode')}
                            </Chip>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="cluster">
                <Button
                  onClick={() => void addPicked()}
                  busy={catalogueBusy === 'add'}
                  disabled={picked.length === 0}
                >
                  {t('torrents.addSelected', { count: String(picked.length) })}
                </Button>
                <span className="fine-print">
                  {t('torrents.selectedSummary', {
                    size: bytes(pickedSize, locale),
                    free: bytes(nodeHeadroom, locale),
                  })}
                </span>
              </div>
              {nodeHeadroom !== null && pickedSize > nodeHeadroom ? (
                <Notice tone="bad">{t('torrents.diskWarn')}</Notice>
              ) : null}
            </div>
          )}
        </Panel>
      ) : null}
      {confirmUntracked ? (
        <Modal title={t('torrents.untrackedTitle')} onClose={() => setConfirmUntracked(false)}>
          <div className="stack">
            <p className="body">
              {t('torrents.untrackedBody', { count: String(untracked.length) })}
            </p>
            <p className="fine-print">{t('torrents.untrackedHint')}</p>
            <div className="cluster cluster--end">
              <Button variant="tertiary" onClick={() => setConfirmUntracked(false)}>
                {t('torrents.cancel')}
              </Button>
              <Button variant="destructive" onClick={() => void removeUntracked()}>
                {t('torrents.untrackedConfirm')}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
