import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
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

export function Reciters(): ReactElement {
  const { user } = useSession();
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
      setError(caught instanceof Error ? caught.message : 'Failed to load reciters');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!newName.trim() || !newInfohash.trim()) return;
    setBusy('add');
    try {
      await api('/reciters', { method: 'POST', body: { name: newName.trim(), riwaya: newRiwaya, infohash: newInfohash.trim(), magnet: newMagnet.trim(), fileCount: Number(newFileCount) || 0 } });
      setNewName(''); setNewInfohash(''); setNewMagnet(''); setNewFileCount('114');
      setShowAdd(false);
      setMessage('Reciter added');
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
      await api(`/reciters/${id}`, { method: 'DELETE' });
      setMessage('Reciter removed');
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
        <h1 className="text-2xl font-bold">Reciters</h1>
        <Button onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? 'Cancel' : 'Add Reciter'}
        </Button>
      </div>

      {error && <Notice tone="bad">{error}</Notice>}
      {message && <Notice tone="info">{message}</Notice>}

      {showAdd && (
        <Panel className="mb-6 p-4">
          <div className="flex flex-col gap-3">
            <Field label="Name">
              {(id) => <Input id={id} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Saad Al-Ghamdi" />}
            </Field>
            <Field label="Riwaya">
              {(id) => <Input id={id} value={newRiwaya} onChange={(e) => setNewRiwaya(e.target.value)} placeholder="Hafs" />}
            </Field>
            <Field label="Infohash">
              {(id) => <Input id={id} value={newInfohash} onChange={(e) => setNewInfohash(e.target.value)} placeholder="abc123..." />}
            </Field>
            <Field label="Magnet (optional)">
              {(id) => <Input id={id} value={newMagnet} onChange={(e) => setNewMagnet(e.target.value)} placeholder="magnet:?xt=urn:btih:..." />}
            </Field>
            <Field label="File Count">
              {(id) => <Input id={id} value={newFileCount} onChange={(e) => setNewFileCount(e.target.value)} placeholder="114" />}
            </Field>
            <Button onClick={add} busy={busy === 'add'} disabled={!newName.trim() || !newInfohash.trim()}>Add</Button>
          </div>
        </Panel>
      )}

      {reciters === null ? (
        <SkeletonRows rows={4} label="Loading" />
      ) : reciters.length === 0 ? (
        <Panel className="p-8 text-center text-gray-500">
          No reciters yet. Click "Add Reciter" to get started.
        </Panel>
      ) : (
        <div className="grid gap-4">
          {reciters.map((r) => (
            <Panel key={r.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{r.name}</span>
                    <Chip tone="info">{r.riwaya}</Chip>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{r.fileCount} files · {r.infohash.slice(0, 16)}...</div>
                </div>
                <Button small variant="destructive" onClick={() => remove(r.id)} disabled={busy === `remove-${r.id}`}>
                  {busy === `remove-${r.id}` ? '...' : 'Remove'}
                </Button>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
