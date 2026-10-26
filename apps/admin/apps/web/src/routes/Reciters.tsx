import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { useI18n } from '../lib/i18n';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { Chip, Notice } from '../components/Chip';
import { Panel } from '../components/Panel';
import { SkeletonRows } from '../components/Skeleton';

interface Reciter {
  id: number;
  name: string;
  riwaya: string;
  infohash: string;
  magnet: string;
  fileCount: number;
  createdAt: string;
}

/**
 * The reciter catalogue: who is published, in which riwaya, and the torrent that
 * carries the release. It binds a person to an infohash so the seeders and this
 * page agree on what a reciter's audio actually is.
 */
export function Reciters(): ReactElement {
  const { user } = useSession();
  const { t } = useI18n();
  const [reciters, setReciters] = useState<Reciter[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRiwaya, setNewRiwaya] = useState('Hafs');
  const [newInfohash, setNewInfohash] = useState('');
  const [newMagnet, setNewMagnet] = useState('');
  const [newFileCount, setNewFileCount] = useState('114');

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

  async function add(): Promise<void> {
    if (!newName.trim() || !newInfohash.trim()) return;
    setBusy('add');
    setError(null);
    try {
      await api('/reciters', {
        method: 'POST',
        body: {
          name: newName.trim(),
          riwaya: newRiwaya,
          infohash: newInfohash.trim(),
          magnet: newMagnet.trim(),
          fileCount: Number(newFileCount) || 0,
        },
      });
      setNewName('');
      setNewInfohash('');
      setNewMagnet('');
      setNewFileCount('114');
      setShowAdd(false);
      setMessage(t('reciters.added'));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('reciters.addFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: number): Promise<void> {
    setBusy(`remove-${id}`);
    setError(null);
    try {
      await api(`/reciters/${id}`, { method: 'DELETE' });
      setMessage(t('reciters.removed'));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('reciters.removeFailed'));
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
          <Button onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? t('reciters.cancel') : t('reciters.add')}
          </Button>
        </div>
      </header>

      {error ? <Notice tone="bad">{error}</Notice> : null}
      {message ? <Notice tone="ok">{message}</Notice> : null}

      {showAdd ? (
        <Panel>
          <div className="stack">
            <Field label={t('reciters.name')}>
              {(id) => (
                <Input
                  id={id}
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
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
                  <th scope="col">{t('reciters.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {reciters.map((reciter) => (
                  <tr key={reciter.id}>
                    <td>
                      <span className="row__label">{reciter.name}</span>
                    </td>
                    <td>
                      <Chip tone="info">{reciter.riwaya}</Chip>
                    </td>
                    <td>
                      <span className="row__id">{reciter.infohash.slice(0, 16)}…</span>
                    </td>
                    <td className="num">{reciter.fileCount}</td>
                    <td>
                      <span className="cluster cluster--end">
                        <Button
                          small
                          variant="destructive"
                          onClick={() => void remove(reciter.id)}
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
    </div>
  );
}
