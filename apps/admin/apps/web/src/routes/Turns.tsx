import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { Chip, Notice } from '../components/Chip';
import { Panel } from '../components/Panel';
import { SkeletonRows } from '../components/Skeleton';
import type { Turn } from '../lib/types-seeders';

export function Turns(): ReactElement {
  const { user } = useSession();
  const [turns, setTurns] = useState<Turn[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');

  const load = useCallback(async () => {
    try {
      setTurns(await api<Turn[]>('/turns'));
    } catch (caught) {
      setTurns([]);
      setError(caught instanceof Error ? caught.message : 'Failed to load TURN servers');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!newName.trim() || !newUrl.trim()) return;
    setBusy('add');
    try {
      await api('/turns', { method: 'POST', body: { name: newName.trim(), url: newUrl.trim() } });
      setNewName('');
      setNewUrl('');
      setShowAdd(false);
      setMessage('TURN server added');
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
      await api(`/turns/${id}`, { method: 'DELETE' });
      setMessage('TURN server removed');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to remove');
    } finally {
      setBusy(null);
    }
  }

  async function poll(id: number) {
    setBusy(`poll-${id}`);
    try {
      await api(`/turns/${id}/poll`, { method: 'POST' });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Poll failed');
    } finally {
      setBusy(null);
    }
  }

  async function pollAll() {
    setBusy('poll-all');
    try {
      await api('/turns/poll-all', { method: 'POST' });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Poll all failed');
    } finally {
      setBusy(null);
    }
  }

  if (!user) return <div className="p-6">Sign in required</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">TURN Servers</h1>
        <div className="flex gap-2">
          <Button onClick={pollAll} busy={busy === 'poll-all'}>Poll all</Button>
          <Button onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? 'Cancel' : 'Add TURN Server'}
          </Button>
        </div>
      </div>

      {error && <Notice tone="bad">{error}</Notice>}
      {message && <Notice tone="info">{message}</Notice>}

      {showAdd && (
        <Panel className="mb-6 p-4">
          <div className="flex flex-col gap-3">
            <Field label="Name">
              {(id) => <Input id={id} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="TURN 1" />}
            </Field>
            <Field label="URL">
              {(id) => <Input id={id} value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="turn:192.168.1.100:3478" />}
            </Field>
            <Button onClick={add} busy={busy === 'add'} disabled={!newName.trim() || !newUrl.trim()}>
              Add
            </Button>
          </div>
        </Panel>
      )}

      {turns === null ? (
        <SkeletonRows rows={4} label="Loading TURN servers" />
      ) : turns.length === 0 ? (
        <Panel className="p-8 text-center text-gray-500">
          No TURN servers yet. Click "Add TURN Server" to get started.
        </Panel>
      ) : (
        <div className="grid gap-4">
          {turns.map((t) => (
            <Panel key={t.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{t.name}</span>
                    <Chip tone={t.status === 'online' ? 'ok' : 'bad'}>{t.status}</Chip>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">{t.url}</div>
                  {t.realm && <div className="text-xs text-gray-400 mt-1">Realm: {t.realm}</div>}
                </div>
                <div className="flex gap-2">
                  <Button small onClick={() => poll(t.id)} busy={busy === `poll-${t.id}`}>Poll</Button>
                  <Button small variant="destructive" onClick={() => remove(t.id)} busy={busy === `remove-${t.id}`}>Remove</Button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
