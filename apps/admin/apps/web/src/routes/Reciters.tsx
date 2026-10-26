import { useCallback, useEffect, useState } from 'react';
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
import { bytes } from '../lib/format';
import type { Seeder } from '../lib/types-seeders';

interface PushNodePlan {
  seederId: number;
  name: string;
  url: string;
  toAdd: { infohash: string; name: string }[];
  present: number;
  skipReason: 'offline' | 'no_credentials' | 'low_space' | 'unreachable' | null;
  detail: string | null;
}

interface PushPlan {
  catalogue: number;
  nodes: PushNodePlan[];
  applied?: { seederId: number; added: number; error: string | null }[];
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
  createdAt: string;
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
  const [newRiwaya, setNewRiwaya] = useState('Hafs');
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
  const [deleting, setDeleting] = useState<Reciter | null>(null);
  const [purgeNodes, setPurgeNodes] = useState(false);
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
    setEditRiwaya(reciter.riwaya);
    setEditInfohash(reciter.infohash);
    setEditMagnet(reciter.magnet);
    setEditSizeGb(reciter.sizeBytes === null ? '' : (reciter.sizeBytes / 1024 ** 3).toFixed(2));
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

  async function applyPush(): Promise<void> {
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

  async function confirmDelete(): Promise<void> {
    if (!deleting) return;
    setBusy('delete');
    setError(null);
    try {
      await api(`/reciters/${deleting.id}?purgeNodes=${purgeNodes}`, { method: 'DELETE' });
      setMessage(purgeNodes ? t('reciters.removedEverywhere') : t('reciters.removed'));
      setDeleting(null);
      setPurgeNodes(false);
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
          <Button onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? t('reciters.cancel') : t('reciters.add')}
          </Button>
        </div>
      </header>

      {error ? <Notice tone="bad">{error}</Notice> : null}
      {message ? <Notice tone="ok">{message}</Notice> : null}

      {editing ? (
        <Panel tone="parchment">
          <h2 className="group-title">
            {t('reciters.editTitle')} — {editing.name}
          </h2>
          <div className="stack">
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
                <Input
                  id={id}
                  value={editRiwaya}
                  onChange={(event) => setEditRiwaya(event.target.value)}
                />
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
            <div className="cluster">
              <Button onClick={() => void saveEdit()} busy={busy === 'edit'}>
                {t('common.save')}
              </Button>
              <Button variant="tertiary" onClick={() => setEditing(null)}>
                {t('reciters.cancel')}
              </Button>
            </div>
          </div>
        </Panel>
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
                  onClick={() => void applyPush()}
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
        <Panel>
          <div className="stack">
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
                <Input
                  id={id}
                  value={newRiwaya}
                  onChange={(event) => setNewRiwaya(event.target.value)}
                  placeholder="Hafs"
                />
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
            <div className="cluster">
              <Button
                onClick={() => void add()}
                busy={busy === 'add'}
                disabled={!newName.trim() || !newInfohash.trim()}
              >
                {t('reciters.addSubmit')}
              </Button>
            </div>
          </div>
        </Panel>
      ) : null}

      {reciters === null ? (
        <SkeletonRows rows={3} label={t('reciters.loading')} />
      ) : reciters.length === 0 ? (
        <Panel>
          <p className="body muted">{t('reciters.empty')}</p>
        </Panel>
      ) : (
        <Panel>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{t('reciters.name')}</th>
                  <th scope="col">{t('reciters.riwaya')}</th>
                  <th scope="col">{t('reciters.infohash')}</th>
                  <th scope="col">{t('reciters.fileCount')}</th>
                  <th scope="col">{t('reciters.size')}</th>
                  <th scope="col">{t('reciters.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {reciters.map((reciter) => (
                  <tr key={reciter.id}>
                    <td>
                      <span className="row__label">{reciter.nameAr ?? reciter.name}</span>
                      {reciter.nameAr ? (
                        <span className="row__id" dir="ltr">
                          {reciter.name}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <Chip tone="info">{reciter.riwaya}</Chip>
                    </td>
                    <td>
                      <span className="row__id">{reciter.infohash.slice(0, 16)}…</span>
                    </td>
                    <td className="num">{reciter.fileCount}</td>
                    <td className="num">
                      {reciter.sizeBytes === null ? '—' : bytes(reciter.sizeBytes, locale)}
                    </td>
                    <td>
                      <span className="cluster cluster--end">
                        <Button small variant="tertiary" onClick={() => startEdit(reciter)}>
                          {t('reciters.edit')}
                        </Button>
                        <Button
                          small
                          variant="destructive"
                          onClick={() => setDeleting(reciter)}
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

      {deleting ? (
        <Modal title={t('reciters.deleteTitle')} onClose={() => setDeleting(null)}>
          <div className="stack">
            <p className="body">{t('reciters.deleteBody', { name: deleting.name })}</p>
            <label className="cluster" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={purgeNodes}
                onChange={(event) => setPurgeNodes(event.target.checked)}
              />
              {t('reciters.deletePurge')}
            </label>
            <div className="cluster cluster--end">
              <Button variant="tertiary" onClick={() => setDeleting(null)}>
                {t('reciters.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => void confirmDelete()}
                busy={busy === 'delete'}
              >
                {t('reciters.deleteConfirm')}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
