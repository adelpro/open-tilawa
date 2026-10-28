import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { useI18n, type MessageKey } from '../lib/i18n';
import { Button } from '../components/Button';
import { Field, Input, TextArea } from '../components/Field';
import { Chip, Notice } from '../components/Chip';
import { Panel } from '../components/Panel';
import { SkeletonRows } from '../components/Skeleton';
import { Modal } from '../components/Modal';
import { ConfirmModal } from '../components/ConfirmModal';
import { FormModal } from '../components/FormModal';
import { bytes } from '../lib/format';
import { isUnclassified, riwayaLabel, riwayaOptions, riwayaValue } from '../lib/riwaya';
import type { Seeder } from '../lib/types-seeders';

interface PushNodePlan {
  seederId: number;
  name: string;
  url: string;
  toAdd: { infohash: string; name: string }[];
  present: number;
  skipReason: 'offline' | 'no_credentials' | 'low_space' | 'unreachable' | null;
  detail: string | null;
  /** Reciters the 90 % cap left out of this node. */
  skipped: number;
  capBytes: number | null;
}

interface PushPlan {
  catalogue: number;
  nodes: PushNodePlan[];
  applied?: { seederId: number; added: number; error: string | null }[];
}

type SortKey = 'name' | 'riwaya' | 'size' | 'nodes' | 'published';

interface ReciterPlacement {
  seederId: number;
  seederName: string;
  state: 'pending' | 'placed' | 'failed';
  error: string | null;
}

interface Reciter {
  id: number;
  name: string;
  nameAr: string | null;
  riwaya: string;
  infohash: string;
  magnet: string;
  fileCount: number;
  sizeBytes: number | null;
  published: boolean;
  createdAt: string;
  /** Nodes whose last report says they hold this — observation, not intent. */
  heldBy: { seederId: number; name: string }[];
  /** What we asked of each node, and what came of it. */
  placements: ReciterPlacement[];
  state: 'healthy' | 'unseeded' | 'stale' | 'dormant';
}

/**
 * The reciter catalogue: who is published, in which riwaya, and the torrent that
 * carries the release. It binds a person to an infohash so the seeders and this
 * page agree on what a reciter's audio actually is.
 */
export function Reciters(): ReactElement {
  const { user } = useSession();
  const { t, locale } = useI18n();
  const [reciters, setReciters] = useState<Reciter[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNameAr, setNewNameAr] = useState('');
  // Unclassified is the honest default: a reading is a fact about the recording,
  // not something to assume (see docs: "Riwaya is data, not a default").
  const [newRiwaya, setNewRiwaya] = useState('unknown');
  const [newInfohash, setNewInfohash] = useState('');
  const [newMagnet, setNewMagnet] = useState('');
  const [newFileCount, setNewFileCount] = useState('114');
  const [newSizeGb, setNewSizeGb] = useState('');
  const [editing, setEditing] = useState<Reciter | null>(null);
  const [editName, setEditName] = useState('');
  const [editNameAr, setEditNameAr] = useState('');
  const [editRiwaya, setEditRiwaya] = useState('');
  const [editInfohash, setEditInfohash] = useState('');
  const [editMagnet, setEditMagnet] = useState('');
  const [editSizeGb, setEditSizeGb] = useState('');
  const [editPublished, setEditPublished] = useState(true);
  const [deleting, setDeleting] = useState<Reciter | null>(null);
  /** Nodes to purge when deleting: unticked unless the operator asks. */
  const [purgeIds, setPurgeIds] = useState<number[]>([]);
  /** The reciter whose placement panel is open, by id so a reload refreshes it. */
  const [placingId, setPlacingId] = useState<number | null>(null);
  const [placementBusy, setPlacementBusy] = useState<number | null>(null);
  /** Column order. Clicking the active column flips it rather than resetting. */
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'name',
    dir: 'asc',
  });
  const [confirmPush, setConfirmPush] = useState<PushPlan | null>(null);
  /**
   * Which half of the catalogue is on screen. Defaults to published: those are
   * the reciters the site offers, and the nineteen drafts made the table read as
   * two dozen releases when three are live.
   */
  const [scope, setScope] = useState<'published' | 'drafts' | 'all'>('published');
  /** '' means every riwaya; otherwise an exact value as stored in the catalogue. */
  const [riwayaFilter, setRiwayaFilter] = useState('');
  const [nodes, setNodes] = useState<Seeder[] | null>(null);
  const [fetchNode, setFetchNode] = useState<number | null>(null);
  const [trackersOpen, setTrackersOpen] = useState(false);
  const [trackersText, setTrackersText] = useState('');
  const [pushing, setPushing] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [plan, setPlan] = useState<PushPlan | null>(null);
  const [pushBusy, setPushBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setReciters(await api<Reciter[]>('/reciters'));
    } catch (caught) {
      setReciters([]);
      setError(caught instanceof Error ? caught.message : t('reciters.loadFailed'));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let live = true;
    api<Seeder[]>('/seeders')
      .then((rows) => {
        if (!live) return;
        setNodes(rows);
        setFetchNode(
          (current) => current ?? rows.find((row) => row.hasCredentials)?.id ?? rows[0]?.id ?? null,
        );
      })
      .catch(() => {
        if (live) setNodes([]);
      });
    return () => {
      live = false;
    };
  }, []);

  async function add(): Promise<void> {
    if (!newName.trim() || !newInfohash.trim()) return;
    setBusy('add');
    setError(null);
    try {
      await api('/reciters', {
        method: 'POST',
        body: {
          name: newName.trim(),
          nameAr: newNameAr.trim() || null,
          riwaya: newRiwaya,
          infohash: newInfohash.trim(),
          magnet: newMagnet.trim(),
          fileCount: Number(newFileCount) || 0,
          sizeBytes: newSizeGb.trim() ? Math.round(Number(newSizeGb) * 1024 ** 3) : null,
        },
      });
      setNewName('');
      setNewNameAr('');
      setNewInfohash('');
      setNewMagnet('');
      setNewFileCount('114');
      setNewSizeGb('');
      setShowAdd(false);
      setMessage(t('reciters.added'));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('reciters.addFailed'));
    } finally {
      setBusy(null);
    }
  }

  function startEdit(reciter: Reciter): void {
    setEditing(reciter);
    setEditName(reciter.name);
    setEditNameAr(reciter.nameAr ?? '');
    setEditRiwaya(riwayaValue(reciter.riwaya));
    setEditInfohash(reciter.infohash);
    setEditMagnet(reciter.magnet);
    setEditSizeGb(reciter.sizeBytes === null ? '' : (reciter.sizeBytes / 1024 ** 3).toFixed(2));
    setEditPublished(reciter.published);
    setError(null);
  }

  async function saveEdit(): Promise<void> {
    if (!editing) return;
    setBusy('edit');
    setError(null);
    try {
      await api(`/reciters/${editing.id}`, {
        method: 'PATCH',
        body: {
          name: editName.trim(),
          nameAr: editNameAr.trim() || null,
          riwaya: editRiwaya,
          infohash: editInfohash.trim(),
          magnet: editMagnet.trim(),
          sizeBytes: editSizeGb.trim() ? Math.round(Number(editSizeGb) * 1024 ** 3) : null,
          published: editPublished,
        },
      });
      setEditing(null);
      setMessage(t('reciters.updated'));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('reciters.updateFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function openTrackers(): Promise<void> {
    setTrackersOpen(true);
    setError(null);
    setBusy('trackers');
    try {
      const { trackers } = await api<{ trackers: string[] }>('/settings/trackers');
      setTrackersText(trackers.join('\n'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('reciters.trackersFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function saveTrackers(): Promise<void> {
    setBusy('trackers');
    setError(null);
    try {
      const result = await api<{ trackers: string[]; rewritten: number }>('/settings/trackers', {
        method: 'PUT',
        body: {
          trackers: trackersText
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
        },
      });
      setTrackersOpen(false);
      setMessage(t('reciters.trackersSaved', { count: String(result.rewritten) }));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('reciters.trackersFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function openPush(): Promise<void> {
    setPushing(true);
    setPlan(null);
    setPushBusy('load');
    setError(null);
    try {
      const rows = await api<Seeder[]>('/seeders');
      setNodes(rows);
      setSelected(
        rows.filter((row) => row.hasCredentials && row.status !== 'offline').map((row) => row.id),
      );
    } catch (caught) {
      setNodes([]);
      setError(caught instanceof Error ? caught.message : t('reciters.pushFailed'));
    } finally {
      setPushBusy(null);
    }
  }

  async function previewPush(): Promise<void> {
    setPushBusy('plan');
    setError(null);
    try {
      setPlan(
        await api<PushPlan>('/reciters/push/plan', { method: 'POST', body: { nodeIds: selected } }),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('reciters.pushFailed'));
    } finally {
      setPushBusy(null);
    }
  }

  /**
   * A push writes to every node at once. It asks first, with the numbers the
   * plan already computed: how many reciters move, and how many the 90 % cap
   * will leave behind.
   */
  async function requestPush(): Promise<void> {
    setPushBusy('plan');
    setError(null);
    try {
      const preview =
        plan ??
        (await api<PushPlan>('/reciters/push/plan', {
          method: 'POST',
          body: { nodeIds: selected },
        }));
      setPlan(preview);
      setConfirmPush(preview);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('reciters.pushFailed'));
    } finally {
      setPushBusy(null);
    }
  }

  async function applyPush(): Promise<void> {
    setConfirmPush(null);
    setPushBusy('apply');
    setError(null);
    try {
      const result = await api<PushPlan>('/reciters/push', {
        method: 'POST',
        body: { nodeIds: selected },
      });
      setPlan(result);
      setMessage(t('reciters.pushDone'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('reciters.pushFailed'));
    } finally {
      setPushBusy(null);
    }
  }

  const counts = useMemo(() => {
    const rows = reciters ?? [];
    const published = rows.filter((row) => row.published).length;
    return { published, drafts: rows.length - published, all: rows.length };
  }, [reciters]);

  /** Every riwaya actually present, so the list never offers an empty filter. */
  const riwayas = useMemo(
    () => [...new Set((reciters ?? []).map((row) => row.riwaya))].sort(),
    [reciters],
  );

  const sorted = useMemo(() => {
    const rows = (reciters ?? []).filter((row) => {
      const inScope =
        scope === 'all' ? true : scope === 'published' ? row.published : !row.published;
      const inRiwaya = riwayaFilter === '' || row.riwaya === riwayaFilter;
      return inScope && inRiwaya;
    });
    const dir = sort.dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      switch (sort.key) {
        case 'riwaya':
          return a.riwaya.localeCompare(b.riwaya) * dir;
        case 'size':
          return ((a.sizeBytes ?? 0) - (b.sizeBytes ?? 0)) * dir;
        case 'nodes':
          return (a.heldBy.length - b.heldBy.length) * dir;
        case 'published':
          return (Number(a.published) - Number(b.published)) * dir;
        default:
          return (a.nameAr ?? a.name).localeCompare(b.nameAr ?? b.name, locale) * dir;
      }
    });
    return rows;
  }, [reciters, sort, locale, scope, riwayaFilter]);

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
          <span aria-hidden="true">{active ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
        </button>
      </th>
    );
  };

  const placing = (reciters ?? []).find((row) => row.id === placingId) ?? null;

  /**
   * Place or unplace one reciter on one node.
   *
   * Unplacing stops seeding and keeps the files: the volume is also the HTTP
   * source, so removing a torrent here must not delete what /media serves.
   */
  async function togglePlacement(seederId: number, active: boolean): Promise<void> {
    if (!placing) return;
    setPlacementBusy(seederId);
    setError(null);
    try {
      if (active) {
        await api(`/reciters/${placing.id}/place`, {
          method: 'POST',
          body: { seederIds: [seederId] },
        });
      } else {
        await api(`/reciters/${placing.id}/place/${seederId}`, { method: 'DELETE' });
      }
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('reciters.placeFailed'));
    } finally {
      setPlacementBusy(null);
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!deleting) return;
    setBusy('delete');
    setError(null);
    try {
      const purge = purgeIds.length > 0 ? `?purge=${purgeIds.join(',')}` : '';
      await api(`/reciters/${deleting.id}${purge}`, { method: 'DELETE' });
      setMessage(purgeIds.length > 0 ? t('reciters.removedEverywhere') : t('reciters.removed'));
      setDeleting(null);
      setPurgeIds([]);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('reciters.removeFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function fetchMetadata(): Promise<void> {
    if (fetchNode === null || !newMagnet.trim()) return;
    setBusy('fetch');
    setError(null);
    try {
      const info = await api<{
        name: string;
        infoHash: string;
        size: number;
        files: number;
        magnet: string;
      }>(`/seeders/${fetchNode}/metadata`, { method: 'POST', body: { magnet: newMagnet.trim() } });
      setNewName(info.name);
      setNewInfohash(info.infoHash);
      setNewMagnet(info.magnet);
      setNewFileCount(String(info.files));
      setNewSizeGb((info.size / 1024 ** 3).toFixed(2));
      setMessage(t('reciters.fetched'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('reciters.fetchFailed'));
    } finally {
      setBusy(null);
    }
  }

  if (!user) return <p className="body muted">{t('reciters.signInRequired')}</p>;

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <h1 className="display-lg">{t('reciters.title')}</h1>
          <p className="body muted">{t('reciters.lede')}</p>
        </div>
        <div className="cluster">
          <Button variant="tertiary" onClick={() => void openTrackers()} busy={busy === 'trackers'}>
            {t('reciters.trackers')}
          </Button>
          <Button variant="secondary" onClick={() => void openPush()} busy={pushBusy === 'load'}>
            {t('reciters.push')}
          </Button>
          <Button onClick={() => setShowAdd(true)}>{t('reciters.add')}</Button>
        </div>
      </header>

      {error ? <Notice tone="bad">{error}</Notice> : null}
      {message ? <Notice tone="ok">{message}</Notice> : null}

      {editing ? (
        <FormModal
          title={`${t('reciters.editTitle')} — ${editing.name}`}
          submitLabel={t('common.save')}
          onSubmit={() => void saveEdit()}
          onClose={() => setEditing(null)}
          busy={busy === 'edit'}
        >
            <Field label={t('reciters.nameAr')} hint={t('reciters.nameArHint')}>
              {(id) => (
                <Input
                  id={id}
                  value={editNameAr}
                  onChange={(event) => setEditNameAr(event.target.value)}
                  dir="rtl"
                  placeholder="ماهر المعيقلي"
                />
              )}
            </Field>
            <Field label={t('reciters.name')} hint={t('reciters.nameHint')}>
              {(id) => (
                <Input
                  id={id}
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  dir="ltr"
                />
              )}
            </Field>
            <Field label={t('reciters.riwaya')} hint={t('reciters.riwayaHint')}>
              {(id) => (
                <select
                  id={id}
                  className="field__select"
                  value={editRiwaya}
                  onChange={(event) => setEditRiwaya(event.target.value)}
                >
                  {riwayaOptions(editRiwaya).map((option) => (
                    <option key={option.value} value={option.value}>
                      {locale === 'ar' ? option.ar : option.en}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={t('reciters.infohash')} hint={t('reciters.infohashHint')}>
              {(id) => (
                <Input
                  id={id}
                  value={editInfohash}
                  onChange={(event) => setEditInfohash(event.target.value)}
                />
              )}
            </Field>
            <div className="cluster cluster--end">
              <Button
                variant="secondary"
                small
                onClick={() => void fetchMetadata()}
                busy={busy === 'fetch'}
                disabled={!newMagnet.trim() || fetchNode === null}
              >
                {t('reciters.fetch')}
              </Button>
              {nodes && nodes.length > 0 ? (
                <select
                  className="field__select"
                  aria-label={t('reciters.fetchNode')}
                  value={fetchNode ?? ''}
                  onChange={(event) => setFetchNode(Number(event.target.value))}
                >
                  {nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
            <Field label={t('reciters.magnet')} hint={t('reciters.magnetHint')}>
              {(id) => (
                <Input
                  id={id}
                  value={editMagnet}
                  onChange={(event) => setEditMagnet(event.target.value)}
                />
              )}
            </Field>
            <Field label={t('reciters.size')} hint={t('reciters.sizeHint')}>
              {(id) => (
                <Input
                  id={id}
                  value={editSizeGb}
                  onChange={(event) => setEditSizeGb(event.target.value)}
                  inputMode="decimal"
                />
              )}
            </Field>
            <label className="cluster" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={editPublished}
                onChange={(event) => setEditPublished(event.target.checked)}
              />
              <span>
                {t('reciters.published')}
                <span className="row__meta"> — {t('reciters.publishedHint')}</span>
              </span>
            </label>
        </FormModal>
      ) : null}

      {pushing ? (
        <Panel tone="parchment">
          <h2 className="group-title">{t('reciters.pushTitle')}</h2>
          <p className="body muted">{t('reciters.pushLede')}</p>
          {nodes === null ? (
            <SkeletonRows rows={2} label={t('reciters.loading')} />
          ) : nodes.length === 0 ? (
            <p className="body muted">{t('torrents.noSeeders')}</p>
          ) : (
            <div className="stack">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">{t('reciters.pushNode')}</th>
                    <th scope="col">{t('seeders.statusHeading')}</th>
                    <th scope="col">{t('reciters.pushFree')}</th>
                  </tr>
                </thead>
                <tbody>
                  {nodes.map((node) => (
                    <tr key={node.id}>
                      <td>
                        <label className="cluster" style={{ cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={selected.includes(node.id)}
                            onChange={(event) =>
                              setSelected((current) =>
                                event.target.checked
                                  ? [...current, node.id]
                                  : current.filter((id) => id !== node.id),
                              )
                            }
                          />
                          <span className="row__label">{node.name}</span>
                        </label>
                        <br />
                        <span className="row__id">{node.url}</span>
                      </td>
                      <td>
                        <Chip tone={node.status === 'online' ? 'ok' : 'notice'}>
                          {t(
                            node.status === 'online'
                              ? 'seeders.statusOnline'
                              : 'seeders.statusOffline',
                          )}
                        </Chip>
                      </td>
                      <td className="num">{bytes(node.freeBytes, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {plan ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">{t('reciters.pushNode')}</th>
                      <th scope="col">{t('reciters.pushPlan')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.nodes.map((node) => {
                      const applied = plan.applied?.find(
                        (entry) => entry.seederId === node.seederId,
                      );
                      return (
                        <tr key={`plan-${node.seederId}`}>
                          <td>{node.name}</td>
                          <td>
                            {node.skipReason
                              ? t(`reciters.skip.${node.skipReason}` as MessageKey)
                              : applied
                                ? t('reciters.pushAdded', { count: String(applied.added) })
                                : t('reciters.pushToAdd', { count: String(node.toAdd.length) })}
                            {node.detail ? ` — ${node.detail}` : ''}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : null}

              <div className="cluster">
                <Button
                  variant="secondary"
                  onClick={() => void previewPush()}
                  busy={pushBusy === 'plan'}
                  disabled={selected.length === 0}
                >
                  {t('reciters.pushPreview')}
                </Button>
                <Button
                  onClick={() => void requestPush()}
                  busy={pushBusy === 'apply'}
                  disabled={!plan || selected.length === 0}
                >
                  {t('reciters.pushApply')}
                </Button>
                <Button variant="tertiary" onClick={() => setPushing(false)}>
                  {t('reciters.pushClose')}
                </Button>
              </div>
            </div>
          )}
        </Panel>
      ) : null}

      {showAdd ? (
        <FormModal
          title={t('reciters.add')}
          submitLabel={t('reciters.addSubmit')}
          onSubmit={() => void add()}
          onClose={() => setShowAdd(false)}
          busy={busy === 'add'}
          disabled={!newName.trim() || !newInfohash.trim()}
        >
            <Field label={t('reciters.name')} hint={t('reciters.nameHint')}>
              {(id) => (
                <Input
                  id={id}
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  dir="ltr"
                />
              )}
            </Field>
            <Field label={t('reciters.nameAr')} hint={t('reciters.nameArHint')}>
              {(id) => (
                <Input
                  id={id}
                  value={newNameAr}
                  onChange={(event) => setNewNameAr(event.target.value)}
                  dir="rtl"
                  placeholder="ماهر المعيقلي"
                />
              )}
            </Field>
            <Field label={t('reciters.riwaya')} hint={t('reciters.riwayaHint')}>
              {(id) => (
                <select
                  id={id}
                  className="field__select"
                  value={newRiwaya}
                  onChange={(event) => setNewRiwaya(event.target.value)}
                >
                  {riwayaOptions(newRiwaya).map((option) => (
                    <option key={option.value} value={option.value}>
                      {locale === 'ar' ? option.ar : option.en}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={t('reciters.infohash')} hint={t('reciters.infohashHint')}>
              {(id) => (
                <Input
                  id={id}
                  value={newInfohash}
                  onChange={(event) => setNewInfohash(event.target.value)}
                />
              )}
            </Field>
            <div className="cluster cluster--end">
              <Button
                variant="secondary"
                small
                onClick={() => void fetchMetadata()}
                busy={busy === 'fetch'}
                disabled={!newMagnet.trim() || fetchNode === null}
              >
                {t('reciters.fetch')}
              </Button>
              {nodes && nodes.length > 0 ? (
                <select
                  className="field__select"
                  aria-label={t('reciters.fetchNode')}
                  value={fetchNode ?? ''}
                  onChange={(event) => setFetchNode(Number(event.target.value))}
                >
                  {nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
            <Field label={t('reciters.magnet')} hint={t('reciters.magnetHint')}>
              {(id) => (
                <Input
                  id={id}
                  value={newMagnet}
                  onChange={(event) => setNewMagnet(event.target.value)}
                  placeholder="magnet:?xt=urn:btih:…"
                />
              )}
            </Field>
            <Field label={t('reciters.fileCount')}>
              {(id) => (
                <Input
                  id={id}
                  value={newFileCount}
                  onChange={(event) => setNewFileCount(event.target.value)}
                  inputMode="numeric"
                />
              )}
            </Field>
            <Field label={t('reciters.size')} hint={t('reciters.sizeHint')}>
              {(id) => (
                <Input
                  id={id}
                  value={newSizeGb}
                  onChange={(event) => setNewSizeGb(event.target.value)}
                  inputMode="decimal"
                  placeholder="6.5"
                />
              )}
            </Field>
        </FormModal>
      ) : null}

      {reciters === null ? (
        <SkeletonRows rows={3} label={t('reciters.loading')} />
      ) : reciters.length === 0 ? (
        <Panel>
          <p className="body muted">{t('reciters.empty')}</p>
        </Panel>
      ) : (
        <Panel>
          <div className="spread" style={{ marginBottom: 'var(--space-3)' }}>
            <p className="body muted">
              {scope === 'published'
                ? t('reciters.scopePublishedHint', { count: String(counts.drafts) })
                : t('reciters.scopeDraftsHint')}
            </p>
            <div className="cluster">
              <select
                className="field__select"
                aria-label={t('reciters.riwayaFilter')}
                value={riwayaFilter}
                onChange={(event) => setRiwayaFilter(event.target.value)}
              >
                <option value="">{t('reciters.allRiwayas')}</option>
                {riwayas.map((row) => (
                  <option key={row} value={row}>
                    {riwayaLabel(row, locale)}
                  </option>
                ))}
              </select>
              <div className="cluster" role="group" aria-label={t('reciters.scope')}>
              <Button
                small
                variant={scope === 'published' ? 'primary' : 'tertiary'}
                onClick={() => setScope('published')}
              >
                {t('reciters.scopePublished', { count: String(counts.published) })}
              </Button>
              <Button
                small
                variant={scope === 'drafts' ? 'primary' : 'tertiary'}
                onClick={() => setScope('drafts')}
              >
                {t('reciters.scopeDrafts', { count: String(counts.drafts) })}
              </Button>
              <Button
                small
                variant={scope === 'all' ? 'primary' : 'tertiary'}
                onClick={() => setScope('all')}
              >
                {t('reciters.scopeAll', { count: String(counts.all) })}
              </Button>
              </div>
            </div>
          </div>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  {sortHeader(t('reciters.name'), 'name')}
                  {sortHeader(t('reciters.riwaya'), 'riwaya')}
                  <th scope="col">{t('reciters.infohash')}</th>
                  <th scope="col">{t('reciters.fileCount')}</th>
                  {sortHeader(t('reciters.size'), 'size')}
                  {sortHeader(t('reciters.coverage'), 'nodes')}
                  <th scope="col">{t('reciters.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((reciter) => (
                  <tr key={reciter.id}>
                    <td>
                      <span className="row__label">{reciter.nameAr ?? reciter.name}</span>
                      {reciter.nameAr ? (
                        <span className="row__id" dir="ltr">
                          {reciter.name}
                        </span>
                      ) : null}
                      {!reciter.published ? <Chip tone="notice">{t('reciters.hidden')}</Chip> : null}
                    </td>
                    <td>
                      <Chip tone={isUnclassified(reciter.riwaya) ? 'notice' : 'info'}>
                        {riwayaLabel(reciter.riwaya, locale)}
                      </Chip>
                    </td>
                    <td>
                      <span className="row__id">{reciter.infohash.slice(0, 16)}…</span>
                    </td>
                    <td className="num">{reciter.fileCount}</td>
                    <td className="num">
                      {reciter.sizeBytes === null ? '—' : bytes(reciter.sizeBytes, locale)}
                    </td>
                    <td>
                      <Chip
                        tone={
                          reciter.state === 'healthy'
                            ? 'ok'
                            : reciter.state === 'unseeded'
                              ? 'notice'
                              : 'info'
                        }
                      >
                        {reciter.state === 'unseeded'
                          ? t('reciters.unseeded')
                          : reciter.state === 'stale'
                            ? t('reciters.stale')
                            : t('reciters.onNodes', { count: String(reciter.heldBy.length) })}
                      </Chip>
                      {reciter.placements.some((p) => p.state === 'pending') ? (
                        <Chip tone="notice">{t('reciters.pending')}</Chip>
                      ) : null}
                    </td>
                    <td>
                      <span className="row__actions">
                        <Button small variant="tertiary" onClick={() => setPlacingId(reciter.id)}>
                          {t('reciters.place')}
                        </Button>
                        <Button small variant="tertiary" onClick={() => startEdit(reciter)}>
                          {t('reciters.edit')}
                        </Button>
                        <Button
                          small
                          variant="destructive"
                          onClick={() => {
                            setPurgeIds([]);
                            setDeleting(reciter);
                          }}
                          busy={busy === `remove-${reciter.id}`}
                        >
                          {t('reciters.remove')}
                        </Button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {trackersOpen ? (
        <Modal title={t('reciters.trackersTitle')} onClose={() => setTrackersOpen(false)}>
          <div className="stack">
            <p className="body muted">{t('reciters.trackersBody')}</p>
            <Field label={t('reciters.trackersLabel')} hint={t('reciters.trackersHint')}>
              {(id) => (
                <TextArea
                  id={id}
                  rows={6}
                  value={trackersText}
                  onChange={(event) => setTrackersText(event.target.value)}
                  placeholder={'wss://tracker.quran.us.kg'}
                />
              )}
            </Field>
            <p className="fine-print">{t('reciters.trackersEffect')}</p>
            <div className="cluster cluster--end">
              <Button variant="tertiary" onClick={() => setTrackersOpen(false)}>
                {t('reciters.cancel')}
              </Button>
              <Button onClick={() => void saveTrackers()} busy={busy === 'trackers'}>
                {t('common.save')}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}


      {placing ? (
        <Modal
          title={t('reciters.placeTitle', { name: placing.nameAr ?? placing.name })}
          onClose={() => setPlacingId(null)}
        >
          <div className="stack">
            <p className="body muted">{t('reciters.placeBody')}</p>
            {nodes === null ? (
              <SkeletonRows rows={2} label={t('reciters.loading')} />
            ) : nodes.length === 0 ? (
              <p className="body muted">{t('torrents.noSeeders')}</p>
            ) : (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">{t('reciters.placeNode')}</th>
                      <th scope="col">{t('reciters.placeFree')}</th>
                      <th scope="col">{t('reciters.placeState')}</th>
                      <th scope="col">{t('reciters.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...nodes]
                      .sort((a, b) => Number(b.pinned) - Number(a.pinned))
                      .map((node) => {
                        const held = placing.heldBy.some((row) => row.seederId === node.id);
                        const placement = placing.placements.find((row) => row.seederId === node.id);
                        // Unknown size is not a reason to refuse; the node enforces the cap itself.
                        const fits =
                          placing.sizeBytes === null ||
                          (node.headroomBytes ?? node.freeBytes ?? 0) >= placing.sizeBytes;
                        return (
                          <tr key={node.id}>
                            <td>
                              <span className="row__label">{node.name}</span>
                              {node.pinned ? <Chip tone="info">{t('seeders.pinned')}</Chip> : null}
                            </td>
                            <td className="num">
                              {node.freeBytes === null ? '—' : bytes(node.freeBytes, locale)}
                            </td>
                            <td>
                              {held ? (
                                <Chip tone="ok">{t('reciters.placePlaced')}</Chip>
                              ) : placement ? (
                                <Chip tone={placement.state === 'failed' ? 'notice' : 'info'}>
                                  {placement.state === 'pending'
                                    ? t('reciters.pending')
                                    : t('reciters.failed')}
                                </Chip>
                              ) : (
                                <Chip tone="info">{t('reciters.placeAbsent')}</Chip>
                              )}
                            </td>
                            <td>
                              <Button
                                small
                                variant={held ? 'destructive' : 'secondary'}
                                busy={placementBusy === node.id}
                                disabled={!held && !fits}
                                title={
                                  fits
                                    ? undefined
                                    : t('reciters.noRoom', {
                                        size:
                                          placing.sizeBytes === null
                                            ? '—'
                                            : bytes(placing.sizeBytes, locale),
                                      })
                                }
                                onClick={() => void togglePlacement(node.id, !held)}
                              >
                                {held ? t('reciters.unplace') : t('reciters.placeAction')}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
            {nodes?.length === 1 ? (
              <p className="body muted">{t('reciters.placeOnlyNode')}</p>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {confirmPush ? (
        <ConfirmModal
          title={t('reciters.pushConfirmTitle')}
          body={t('reciters.pushConfirmBody', {
            add: String(confirmPush.nodes.reduce((sum, node) => sum + node.toAdd.length, 0)),
            nodes: String(confirmPush.nodes.filter((node) => node.toAdd.length > 0).length),
            skip: String(confirmPush.nodes.reduce((sum, node) => sum + node.skipped, 0)),
          })}
          confirmLabel={t('reciters.pushApply')}
          busy={pushBusy === 'apply'}
          onClose={() => setConfirmPush(null)}
          onConfirm={() => void applyPush()}
        />
      ) : null}

      {deleting ? (
        <ConfirmModal
          title={t('reciters.deleteTitle')}
          body={t('reciters.deleteBody', { name: deleting.name })}
          confirmLabel={t('reciters.deleteConfirm')}
          destructive
          busy={busy === 'delete'}
          onClose={() => setDeleting(null)}
          onConfirm={() => void confirmDelete()}
        >
          <div className="stack stack--tight">
            <p className="body muted">{t('reciters.deleteNodesHint')}</p>
            {nodes && nodes.length > 0 ? (
              <>
                <label className="cluster" style={{ cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={purgeIds.length === nodes.length}
                    onChange={(event) =>
                      setPurgeIds(event.target.checked ? nodes.map((node) => node.id) : [])
                    }
                  />
                  {t('reciters.deleteSelectAll')}
                </label>
                {nodes.map((node) => (
                  <label key={node.id} className="cluster" style={{ cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={purgeIds.includes(node.id)}
                      onChange={(event) =>
                        setPurgeIds((current) =>
                          event.target.checked
                            ? [...current, node.id]
                            : current.filter((id) => id !== node.id),
                        )
                      }
                    />
                    {node.name}
                  </label>
                ))}
              </>
            ) : null}
          </div>
        </ConfirmModal>
      ) : null}
    </div>
  );
}
