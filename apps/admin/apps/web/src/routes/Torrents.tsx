import { useCallback, useEffect, useState, type ReactElement } from 'react';

import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { useI18n } from '../lib/i18n';
import { bytes } from '../lib/format';
import { Button } from '../components/Button';
import { Chip, Notice } from '../components/Chip';
import { Panel } from '../components/Panel';
import { SkeletonRows } from '../components/Skeleton';
import { ConfirmModal } from '../components/ConfirmModal';
import { linkProps } from '../lib/router';
import type { Seeder, SeederInventory } from '../lib/types-seeders';

interface CatalogueRow {
  id: number;
  infohash: string;
  published: boolean;
}

type RowState = 'healthy' | 'stale' | 'orphan';

/**
 * One node, and only what is on it.
 *
 * Adding lives on the Reciters screen: a torrent enters the system through the
 * catalogue, which is what decides which node should carry it. This page is the
 * repair bench — what is here, whether it should be, and how to remove it.
 */
export function Torrents({ seederId }: { seederId?: string }): ReactElement {
  const { user } = useSession();
  const { t, locale } = useI18n();
  const [node, setNode] = useState<Seeder | null>(null);
  const [inventory, setInventory] = useState<SeederInventory | null>(null);
  const [catalogue, setCatalogue] = useState<CatalogueRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const id = Number(seederId);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [seeders, inv, rows] = await Promise.all([
        api<Seeder[]>('/seeders'),
        api<SeederInventory>(`/seeders/${id}/torrents`),
        api<CatalogueRow[]>('/reciters'),
      ]);
      setNode(seeders.find((row) => row.id === id) ?? null);
      setInventory(inv);
      setCatalogue(rows);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('torrents.loadFailed'));
    }
  }, [id, t]);

  useEffect(() => {
    if (Number.isFinite(id)) void load();
  }, [id, load]);

  async function remove(infoHash: string): Promise<void> {
    setRemoving(null);
    setBusy(`remove-${infoHash}`);
    setError(null);
    try {
      await api(`/seeders/${id}/torrents/${infoHash}`, { method: 'DELETE' });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('torrents.removeFailed'));
    } finally {
      setBusy(null);
    }
  }

  if (!user) return <p className="body muted">{t('torrents.signInRequired')}</p>;
  if (!Number.isFinite(id)) return <p className="body muted">{t('torrents.noNode')}</p>;

  const byHash = new Map(catalogue.map((row) => [row.infohash.toLowerCase(), row]));
  const stateOf = (infoHash: string): RowState => {
    const row = byHash.get(infoHash.toLowerCase());
    if (!row) return 'orphan';
    return row.published ? 'healthy' : 'stale';
  };

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <a className="fine-print" {...linkProps('/seeders')}>
            ← {t('torrents.backToSeeders')}
          </a>
          <h1 className="display-lg">{node?.name ?? t('torrents.nodeTitle')}</h1>
          {node ? (
            <p className="body muted">
              {node.url} ·{' '}
              <Chip tone={node.status === 'online' ? 'ok' : 'notice'}>{node.status}</Chip>
              {node.version ? <Chip tone="info">v{node.version}</Chip> : null}
              {node.sha ? <span className="row__meta"> sha {node.sha}</span> : null}
            </p>
          ) : null}
        </div>
        <div className="cluster">
          <Button variant="secondary" onClick={() => void load()} busy={busy === 'refresh'}>
            {t('torrents.refresh')}
          </Button>
        </div>
      </header>

      {error ? <Notice tone="bad">{error}</Notice> : null}

      {inventory === null ? (
        <SkeletonRows rows={3} label={t('torrents.loading')} />
      ) : (
        <Panel>
          <div className="spread" style={{ marginBottom: 'var(--space-3)' }}>
            <div>
              <h2 className="group-title">{t('torrents.onNodeTitle')}</h2>
              <p className="body muted">
                {t('torrents.summary', {
                  count: String(inventory.stats.totalTorrents),
                  peers: String(inventory.stats.totalPeers),
                })}
                {node?.lastSeen ? (
                  <> · {t('torrents.asOf', { time: node.lastSeen })}</>
                ) : null}
              </p>
            </div>
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
                    <th scope="col">{t('torrents.state')}</th>
                    <th scope="col">{t('torrents.peers')}</th>
                    <th scope="col">{t('torrents.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.torrents.map((torrent) => {
                    const state = stateOf(torrent.infoHash);
                    return (
                      <tr key={torrent.infoHash}>
                        <td>
                          <span className="row__label">{torrent.name}</span>
                          <span className="row__id">{torrent.infoHash}</span>
                        </td>
                        <td className="num">{bytes(torrent.size, locale)}</td>
                        <td>
                          <Chip tone={state === 'healthy' ? 'ok' : 'notice'}>
                            {t(
                              state === 'healthy'
                                ? 'torrents.stateHealthy'
                                : state === 'stale'
                                  ? 'torrents.stateStale'
                                  : 'torrents.stateOrphan',
                            )}
                          </Chip>
                        </td>
                        <td className="num">{torrent.peers}</td>
                        <td>
                          <span className="row__actions">
                            <Button
                              small
                              variant="destructive"
                              onClick={() => setRemoving(torrent.infoHash)}
                              busy={busy === `remove-${torrent.infoHash}`}
                            >
                              {t('torrents.remove')}
                            </Button>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {removing ? (
        <ConfirmModal
          title={t('torrents.removeTitle')}
          body={t('torrents.removeBody')}
          confirmLabel={t('torrents.removeConfirm')}
          destructive
          busy={busy === `remove-${removing}`}
          onClose={() => setRemoving(null)}
          onConfirm={() => void remove(removing)}
        />
      ) : null}
    </div>
  );
}
