import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useSession } from '../lib/session';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { Chip, Notice } from '../components/Chip';
import { Panel } from '../components/Panel';
import { SkeletonRows } from '../components/Skeleton';
import type { Seeder } from '../lib/types-seeders';

export function Seeders(): ReactElement {
  const { t } = useI18n();
  const { user } = useSession();
  const [seeders, setSeeders] = useState<Seeder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      setSeeders(await api<Seeder[]>('/seeders'));
    } catch (caught) {
      setSeeders([]);
      setError(caught instanceof Error ? caught.message : 'Failed to load seeders');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!newName.trim() || !newUrl.trim()) return;
    setBusy('add');
    try {
      await api('/seeders', { method: 'POST', body: { name: newName.trim(), url: newUrl.trim() } });
      setNewName('');
      setNewUrl('');
      setShowAdd(false);
      setMessage('Seeder added');
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
      await api(`/seeders/${id}`, { method: 'DELETE' });
      setMessage('Seeder removed');
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
      await api(`/seeders/${id}/poll`, { method: 'POST' });
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
      await api('/seeders/poll-all', { method: 'POST' });
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
        <h1 className="text-2xl font-bold">Seeders</h1>
        <div className="flex gap-2">
          <Button onClick={pollAll} disabled={busy === 'poll-all'}>
            {busy === 'poll-all' ? 'Polling...' : 'Poll All'}
          </Button>
          <Button onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? 'Cancel' : 'Add Seeder'}
          </Button>
        </div>
      </div>

      {error && <Notice tone="error" className="mb-4">{error}</Notice>}
      {message && <Notice tone="info" className="mb-4">{message}</Notice>}

      {showAdd && (
        <Panel className="mb-6 p-4">
          <div className="flex flex-col gap-3">
            <Field label="Name">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Seeder 1" />
            </Field>
            <Field label="URL">
              <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="http://192.168.1.100:8085" />
            </Field>
            <Button onClick={add} disabled={busy === 'add' || !newName.trim() || !newUrl.trim()}>
              {busy === 'add' ? 'Adding...' : 'Add'}
            </Button>
          </div>
        </Panel>
      )}

      {seeders === null ? (
        <SkeletonRows />
      ) : seeders.length === 0 ? (
        <Panel className="p-8 text-center text-gray-500">
          No seeders yet. Click "Add Seeder" to get started.
        </Panel>
      ) : (
        <div className="grid gap-4">
          {seeders.map((s) => (
            <Panel key={s.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{s.name}</span>
                    <Chip tone={s.status === 'online' ? 'success' : 'error'}>{s.status}</Chip>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">{s.url}</div>
                  {s.status === 'online' && (
                    <div className="text-xs text-gray-400 mt-1">
                      {s.torrentCount} torrents · {s.peerCount} peers · ↑{s.uploadSpeed} ↓{s.downloadSpeed}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => poll(s.id)} disabled={busy === `poll-${s.id}`}>
                    {busy === `poll-${s.id}` ? '...' : 'Poll'}
                  </Button>
                  <Button size="sm" tone="danger" onClick={() => remove(s.id)} disabled={busy === `remove-${s.id}`}>
                    {busy === `remove-${s.id}` ? '...' : 'Remove'}
                  </Button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
