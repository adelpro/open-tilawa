import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react';

import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { useI18n } from '../lib/i18n';
import { bytes, relative } from '../lib/format';
import { Button } from '../components/Button';
import { Icon } from '../components/icons';
import { Chip, Notice } from '../components/Chip';
import { Panel } from '../components/Panel';
import { SkeletonRows } from '../components/Skeleton';
import { ConfirmModal } from '../components/ConfirmModal';
import { linkProps } from '../lib/router';
import { statusKey, statusTone } from '../lib/seeder-status';
import type { Seeder, SeederInventory, SeederPeers } from '../lib/types-seeders';

interface CatalogueRow {
  id: number;
  infohash: string;
  published: boolean;
}

type RowState = 'healthy' | 'stale' | 'orphan';

/** Severity, not spelling: sorting the labels would order them by alphabet. */
const RANK: Record<RowState, number> = { healthy: 0, stale: 1, orphan: 2 };

type SortKey = 'name' | 'size' | 'state' | 'peers';

/**
 * One node, and only what is on it.
 *
 * Adding lives on the Reciters screen: a torrent enters the system through the
 * catalogue, which is what decides which node should carry it. This page is the
 * repair bench — what is here, whether it should be, and how to remove it — plus
 * the two acts that belong to one node alone: probe it, and update its software.
 */
export function Torrents({ seederId }: { seederId?: string }): ReactElement {
  const { user } = useSession();
  const { t, locale } = useI18n();
  const [node, setNode] = useState<Seeder | null>(null);
  const [inventory, setInventory] = useState<SeederInventory | null>(null);
  const [catalogue, setCatalogue] = useState<CatalogueRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirmingUpdate, setConfirmingUpdate] = useState(false);
  /**
   * Who is connected, and when we asked. A swarm is live, so the answer is
   * stamped with the moment it arrived: an unstamped list reads as current
   * forever, which is the lie the refresh button exists to prevent.
   */
  const [peers, setPeers] = useState<SeederPeers | null>(null);
  const [peersError, setPeersError] = useState<string | null>(null);
  const [peersAt, setPeersAt] = useState<string | null>(null);
  /** The torrent whose peer list is open. One at a time: the table stays legible. */
  const [openPeers, setOpenPeers] = useState<string | null>(null);
  /** Column order. Clicking the active column flips it rather than resetting. */
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'name',
    dir: 'asc',
  });
  /**
   * A software update runs on the host for minutes, so this screen polls for it.
   * The flag stops the loop writing state into a tree that is already gone.
   */
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const id = Number(seederId);

  const load = useCallback(async () => {
    setError(null);
    // The peer report is a separate question with its own failure mode: a node
    // running an older seeder answers 502, and that must explain itself under the
    // table rather than read as "this screen failed to load".
    const live = api<SeederPeers>(`/seeders/${id}/peers`).then(
      (value) => ({ value, error: null as string | null }),
      (caught: unknown) => ({
        value: null,
        error: caught instanceof Error ? caught.message : t('torrents.peersFailed'),
      }),
    );
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
    const report = await live;
    if (!alive.current) return;
    setPeers(report.value);
    setPeersError(report.error);
    if (report.value) setPeersAt(new Date().toISOString());
  }, [id, t]);

  useEffect(() => {
    if (Number.isFinite(id)) void load();
  }, [id, load]);

  /**
   * Ask the node itself, then re-read. Re-reading alone returns the console's
   * cache, which is refreshed every five minutes — a button called "refresh" that
   * never contacts the node is why the timestamp looked frozen.
   */
  async function probe(): Promise<void> {
    setBusy('probe');
    setError(null);
    setMessage(null);
    try {
      await api(`/seeders/${id}/poll`, { method: 'POST' });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('seeders.pollFailed'));
    } finally {
      setBusy(null);
    }
  }

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

  /**
   * Fill an empty node from the catalogue.
   *
   * Registering a node no longer queues the catalogue by default, so this is the
   * step that used to happen silently. It is the same push the fleet screen runs,
   * narrowed to this one node.
   */
  async function fillNode(): Promise<void> {
    setBusy('fill');
    setError(null);
    setMessage(null);
    try {
      const result = await api<{
        applied?: { seederId: number; added: number; error: string | null }[];
      }>('/reciters/push', { method: 'POST', body: { nodeIds: [id] } });
      const row = result.applied?.find((entry) => entry.seederId === id);
      if (row?.error) setError(t('seeders.fillFailed', { error: row.error }));
      else setMessage(t('seeders.fillQueued', { count: String(row?.added ?? 0) }));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('seeders.completeFailed'));
    } finally {
      setBusy(null);
    }
  }

  /**
   * Rebuild or pull the node's image on the host, then wait for it to answer.
   *
   * The request returns as soon as the job starts: a build takes minutes, and the
   * console sits behind a proxy that gives up long before that. Progress is the
   * row's `updating` flag, which the API owns.
   */
  async function updateSoftware(): Promise<void> {
    setConfirmingUpdate(false);
    setBusy('update');
    setError(null);
    setMessage(null);
    try {
      await api(`/seeders/${id}/update`, { method: 'POST' });
      let latest: Seeder | undefined = node ?? undefined;
      for (let attempt = 0; attempt < 100 && alive.current; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 3000));
        const rows = await api<Seeder[]>('/seeders');
        latest = rows.find((entry) => entry.id === id);
        if (!latest?.updating) break;
      }
      if (!alive.current) return;
      if (latest?.updateError) {
        setError(t('seeders.updateError', { error: latest.updateError }));
      } else {
        setMessage(
          t('seeders.updatedSoftware', {
            version: latest?.version ?? t('seeders.versionUnknown'),
          }),
        );
      }
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('seeders.updateFailed'));
    } finally {
      if (alive.current) setBusy(null);
    }
  }

  const byHash = useMemo(
    () => new Map(catalogue.map((row) => [row.infohash.toLowerCase(), row])),
    [catalogue],
  );
  const stateOf = useCallback(
    (infoHash: string): RowState => {
      const row = byHash.get(infoHash.toLowerCase());
      if (!row) return 'orphan';
      return row.published ? 'healthy' : 'stale';
    },
    [byHash],
  );

  /** The live peer groups, keyed the same way the table identifies a torrent. */
  const peerGroups = useMemo(
    () => new Map((peers?.torrents ?? []).map((group) => [group.infoHash.toLowerCase(), group])),
    [peers],
  );

  /** The node's own list, ordered. A copy: the inventory is state, not ours to sort. */
  const sorted = useMemo(() => {
    const rows = [...(inventory?.torrents ?? [])];
    const dir = sort.dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      switch (sort.key) {
        case 'size':
          return (a.size - b.size) * dir;
        case 'peers':
          return (a.peers - b.peers) * dir;
        case 'state':
          return (RANK[stateOf(a.infoHash)] - RANK[stateOf(b.infoHash)]) * dir;
        default:
          return a.name.localeCompare(b.name, locale) * dir;
      }
    });
    return rows;
  }, [inventory, sort, locale, stateOf]);

  if (!user) return <p className="body muted">{t('torrents.signInRequired')}</p>;
  if (!Number.isFinite(id)) return <p className="body muted">{t('torrents.noNode')}</p>;

  const hasPublishedCatalogue = catalogue.some((row) => row.published);
  const behind = Boolean(
    node?.version && node.desiredVersion && node.version !== node.desiredVersion,
  );

  function toggleSort(key: SortKey): void {
    setSort((current) =>
      current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    );
  }

  /**
   * A sortable column header. `aria-sort` is what tells a screen reader the
   * table is ordered, so the arrow is decoration and the attribute is the fact.
   */
  const sortHeader = (label: string, key: SortKey): ReactElement => {
    const active = sort.key === key;
    return (
      <th
        scope="col"
        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <button type="button" className="th-sort" onClick={() => toggleSort(key)}>
          {label}
          {active ? <Icon name={sort.dir === 'asc' ? 'up' : 'down'} /> : null}
        </button>
      </th>
    );
  };

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <a className="fine-print back-link" {...linkProps('/seeders')}>
            <Icon name="back" />
            {t('torrents.backToSeeders')}
          </a>
          <h1 className="display-lg">{node?.name ?? t('torrents.nodeTitle')}</h1>
          {node ? (
            <p className="body muted">
              {node.url} · <Chip tone={statusTone(node.status)}>{t(statusKey(node.status))}</Chip>
              {node.version ? <Chip tone="info">v{node.version}</Chip> : null}
              {behind && node.desiredVersion ? (
                <Chip tone="notice">{t('seeders.behind', { version: node.desiredVersion })}</Chip>
              ) : null}
              {node.sha ? <span className="row__meta"> sha {node.sha}</span> : null}
            </p>
          ) : null}
        </div>
        <div className="cluster">
          <Button
            variant="secondary"
            icon={<Icon name="refresh" />}
            onClick={() => void probe()}
            busy={busy === 'probe'}
          >
            {t('torrents.probe')}
          </Button>
          {node?.pinned && (behind || node.updating) ? (
            <Button
              icon={<Icon name="refresh" />}
              busy={busy === 'update' || node.updating}
              onClick={() => setConfirmingUpdate(true)}
            >
              {t('seeders.updateSoftware')}
            </Button>
          ) : null}
        </div>
      </header>

      {error ? <Notice tone="bad">{error}</Notice> : null}
      {message ? <Notice tone="ok">{message}</Notice> : null}

      {/* Who is connected, live. The summary answers the operator's real question —
          is web seeding working, and is my peer port reachable — in one line; the
          per-torrent lists live under the torrent they belong to. */}
      {peers ? (
        <Panel>
          <div className="spread">
            <div>
              <h2 className="group-title">{t('torrents.peersTitle')}</h2>
              <p className="body muted">
                {t('torrents.peersCount', { count: peers.total })}
                {peersAt ? (
                  <> · {t('torrents.peersAsOf', { time: relative(peersAt, locale) })}</>
                ) : null}
              </p>
            </div>
            <div className="cluster">
              <Chip tone="info">{t('torrents.peersWeb', { count: peers.web })}</Chip>
              <Chip tone="info">{t('torrents.peersTcp', { count: peers.tcp })}</Chip>
              <Chip tone="notice">{t('torrents.peersInbound', { count: peers.inbound })}</Chip>
            </div>
          </div>
          <p className="fine-print">
            {peers.total === 0 ? t('torrents.peersNone') : t('torrents.peersHint')}
          </p>
        </Panel>
      ) : peersError ? (
        // An older node is a fact about the node, not a fault of this screen: the
        // message names the version to update, so it reads as a notice.
        <Notice tone="notice">{peersError}</Notice>
      ) : null}

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
                  <> · {t('torrents.asOf', { time: relative(node.lastSeen, locale) })}</>
                ) : null}
              </p>
            </div>
          </div>

          {inventory.torrents.length === 0 ? (
            <div className="stack stack--tight">
              <p className="body muted">{t('torrents.empty')}</p>
              {hasPublishedCatalogue ? (
                <>
                  <p className="body">{t('torrents.emptyNode')}</p>
                  <div>
                    <Button
                      variant="secondary"
                      busy={busy === 'fill'}
                      onClick={() => void fillNode()}
                    >
                      {t('torrents.fillNode')}
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    {sortHeader(t('torrents.name'), 'name')}
                    {sortHeader(t('torrents.size'), 'size')}
                    {sortHeader(t('torrents.state'), 'state')}
                    {sortHeader(t('torrents.peers'), 'peers')}
                    <th scope="col">{t('torrents.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((torrent) => {
                    const state = stateOf(torrent.infoHash);
                    const group = peerGroups.get(torrent.infoHash.toLowerCase());
                    const open = openPeers === torrent.infoHash;
                    return (
                      <Fragment key={torrent.infoHash}>
                        <tr>
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
                          <td className="num">
                            {/* The count is the door: a number that opens the people
                                behind it, and stays a number when there are none. */}
                            {group && group.total > 0 ? (
                              <button
                                type="button"
                                className="th-sort"
                                aria-expanded={open}
                                aria-label={t(open ? 'torrents.peersHide' : 'torrents.peersShow', {
                                  count: group.total,
                                })}
                                onClick={() => setOpenPeers(open ? null : torrent.infoHash)}
                              >
                                {group.total}
                                <Icon name={open ? 'up' : 'down'} />
                              </button>
                            ) : (
                              torrent.peers
                            )}
                          </td>
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
                        {open && group ? (
                          <tr className="table__detail">
                            <td colSpan={5}>
                              <table className="table table--nested">
                                <thead>
                                  <tr>
                                    <th scope="col">{t('torrents.peerType')}</th>
                                    <th scope="col">{t('torrents.peerDirection')}</th>
                                    <th scope="col">{t('torrents.peerAddress')}</th>
                                    <th scope="col">{t('torrents.peerUp')}</th>
                                    <th scope="col">{t('torrents.peerDown')}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.peers.map((peer, index) => (
                                    <tr key={`${peer.type}-${peer.address ?? 'web'}-${index}`}>
                                      <td>
                                        {t(
                                          peer.type === 'web'
                                            ? 'torrents.peerTypeWeb'
                                            : peer.type === 'tcp'
                                              ? 'torrents.peerTypeTcp'
                                              : 'torrents.peerTypeOther',
                                        )}
                                      </td>
                                      <td>
                                        {peer.direction === null
                                          ? t('torrents.peerDirectionUnknown')
                                          : t(
                                              peer.direction === 'in'
                                                ? 'torrents.peerIn'
                                                : 'torrents.peerOut',
                                            )}
                                      </td>
                                      <td className="num">
                                        <bdi dir="ltr">
                                          {peer.address ?? t('torrents.peerAddressNone')}
                                        </bdi>
                                      </td>
                                      <td className="num">
                                        <bdi>{bytes(peer.uploadSpeed, locale, true)}</bdi>
                                      </td>
                                      <td className="num">
                                        <bdi>{bytes(peer.downloadSpeed, locale, true)}</bdi>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {group.truncated ? (
                                <p className="fine-print">
                                  {t('torrents.peersTruncated', { count: group.peers.length })}
                                </p>
                              ) : null}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
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

      {confirmingUpdate && node ? (
        <ConfirmModal
          title={t('seeders.updateTitle')}
          body={t(
            node.updateMode === 'build' ? 'seeders.updateBodyBuild' : 'seeders.updateBodyPull',
          )}
          hint={t('seeders.updateCurrent', {
            version: node.version ?? t('seeders.versionUnknown'),
          })}
          confirmLabel={t('seeders.updateConfirm')}
          busy={busy === 'update'}
          onClose={() => setConfirmingUpdate(false)}
          onConfirm={() => void updateSoftware()}
        />
      ) : null}
    </div>
  );
}
