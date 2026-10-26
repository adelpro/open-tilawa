import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { Notice } from '../components/Chip';
import { Panel } from '../components/Panel';
import { SkeletonRows } from '../components/Skeleton';

interface Torrent {
  id: number;
  name: string;
  infohash: string;
  magnet: string;
  createdAt: string;
}

export function Torrents(): ReactElement {
  const { user } = useSession();
  const [torrents, setTorrents] = useState<Torrent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newInfohash, setNewInfohash] = useState('');
  const [newMagnet, setNewMagnet] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      setTorrents(await api<Torrent[]>('/torrents'));
    } catch (caught) {
      setTorrents([]);
      setError(caught instanceof Error ? caught.message : 'Failed to load torrents');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!newName.trim() || !newInfohash.trim()) return;
    setBusy('add');
    try {
      await api('/torrents', { method: 'POST', body: { name: newName.trim(), infohash: newInfohash.trim(), magnet: newMagnet.trim() } });
      setNewName(''); setNewInfohash(''); setNewMagnet('');
      setShowAdd(false);
      setMessage('Torrent added');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to add');
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: number) {
    setBusy(`remove-${id}`);
    try {
      await api(`/torrents/${id}`, { method: 'DELETE' });
      setMessage('Torrent removed');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to remove');
    } finally {
      setBusy(null);
    }
  }

  if (!user) return <div className="p-6">Sign in required</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Torrent Files</h1>
        <Button onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? 'Cancel' : 'Add Torrent'}
        </Button>
      </div>

      {error && <Notice tone="bad">{error}</Notice>}
      {message && <Notice tone="info">{message}</Notice>}

      {showAdd && (
        <Panel className="mb-6 p-4">
          <div className="flex flex-col gap-3">
            <Field label="Name">
              {(id) => <Input id={id} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Reciter Name" />}
            </Field>
            <Field label="Infohash">
              {(id) => <Input id={id} value={newInfohash} onChange={(e) => setNewInfohash(e.target.value)} placeholder="abc123..." />}
            </Field>
            <Field label="Magnet (optional)">
              {(id) => <Input id={id} value={newMagnet} onChange={(e) => setNewMagnet(e.target.value)} placeholder="magnet:?xt=urn:btih:..." />}
            </Field>
            <Button onClick={add} busy={busy === 'add'} disabled={!newName.trim() || !newInfohash.trim()}>Add</Button>
          </div>
        </Panel>
      )}

      {torrents === null ? (
        <SkeletonRows rows={4} label="Loading" />
      ) : torrents.length === 0 ? (
        <Panel className="p-8 text-center text-gray-500">
          No torrents yet. Click "Add Torrent" to get started.
        </Panel>
      ) : (
        <div className="grid gap-4">
          {torrents.map((t) => (
            <Panel key={t.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold">{t.name}</span>
                  <div className="text-xs text-gray-400 mt-1 font-mono">{t.infohash}</div>
                  <div className="text-xs text-gray-400 mt-1">{t.createdAt}</div>
                </div>
                <Button small variant="destructive" onClick={() => remove(t.id)} disabled={busy === `remove-${t.id}`}>
                  {busy === `remove-${t.id}` ? '...' : 'Remove'}
                </Button>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
