import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { linkProps, navigate } from '../lib/router';
import { bytes } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { Chip, Notice } from '../components/Chip';
import { NodeCard } from '../components/NodeCard';
import type { NodeMetric } from '../components/NodeCard';
import { Icon } from '../components/icons';
import { CopyLine } from '../components/CopyLine';
import { ConfirmModal } from '../components/ConfirmModal';
import { Panel } from '../components/Panel';
import { FormModal } from '../components/FormModal';
import { SkeletonRows } from '../components/Skeleton';
import { missingPerNode, totalMissing } from '../lib/coverage';
import { statusKey, statusTone } from '../lib/seeder-status';
import type { CoverageReciter } from '../lib/coverage';
import type { PushPlan, Seeder } from '../lib/types-seeders';

/**
 * The install command, copy-paste rather than paraphrased. Defaults are the script's:
 * port 8085, admin user `admin`, peer port 6881, and no disk cap unless --disk is
 * passed. ADMIN_PASS is deliberately omitted — the script generates one and prints
 * it, which is the only moment the operator can read it.
 */
const INSTALL_COMMAND =
  'curl -sSL https://raw.githubusercontent.com/adelpro/open-tilawa/main/deploy-node.sh | bash -s -- --type seeder';
const FIREWALL_COMMAND = 'ufw allow 8085/tcp && ufw allow 6881/tcp && ufw allow 6881/udp';

/**
 * Seeder nodes. The URL is public (its `/health` is); the admin credentials are
 * stored on the row and used server-side only — the API never returns them, so
 * this screen can only say whether they are set.
 */
export function Seeders(): ReactElement {
  const { user } = useSession();
  const { t, locale } = useI18n();
  const [seeders, setSeeders] = useState<Seeder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  /** Shown after a bulk top-up that had to stop at the 90% cap. */
  const [completeNote, setCompleteNote] = useState<string | null>(null);
  /** The bulk push runs on every node, so it asks before it starts. */
  const [confirmingComplete, setConfirmingComplete] = useState(false);
  /**
   * The plan behind the dialog. Fetched when the operator asks, shown before they
   * confirm, and reused for the "left out" count afterwards — one computation, so
   * the promise and the result cannot disagree.
   */
  const [plan, setPlan] = useState<PushPlan | null>(null);
  /** Cached coverage, for the "nothing to do" hint. Never a request to a node. */
  const [catalogue, setCatalogue] = useState<CoverageReciter[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  // Default off: registering a node is a cheap, reversible act, while queueing
  // the whole published catalogue is a multi-gigabyte download the operator
  // should ask for. The node's own screen offers it the moment the node is empty.
  const [newFill, setNewFill] = useState(false);
  const [editing, setEditing] = useState<Seeder | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editUser, setEditUser] = useState('');
  const [editPass, setEditPass] = useState('');

  const load = useCallback(async () => {
    setError(null);
    // The two reads fail independently: a console that cannot read the catalogue
    // still has to show the fleet, and must not disable an action that is valid.
    const [fleet, coverage] = await Promise.allSettled([
      api<Seeder[]>('/seeders'),
      api<CoverageReciter[]>('/reciters'),
    ]);
    setCatalogue(coverage.status === 'fulfilled' ? coverage.value : null);
    if (fleet.status === 'fulfilled') {
      setSeeders(fleet.value);
      return;
    }
    setSeeders([]);
    const caught: unknown = fleet.reason;
    setError(caught instanceof Error ? caught.message : t('seeders.loadFailed'));
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(): Promise<void> {
    if (!newName.trim() || !newUrl.trim()) return;
    setBusy('add');
    setError(null);
    try {
      const created = await api<{ id: number }>('/seeders', {
        method: 'POST',
        body: {
          name: newName.trim(),
          url: newUrl.trim(),
          adminUser: newUser.trim() || undefined,
          adminPass: newPass || undefined,
        },
      });
      setNewName('');
      setNewUrl('');
      setNewUser('');
      setNewPass('');
      setShowAdd(false);
      // Fill at add time: the operator should not have to tick the catalogue
      // checklist for a node they just registered.
      let filled: string | null = null;
      if (newFill) {
        try {
          const result = await api<{
            applied: { seederId: number; added: number; error: string | null }[];
          }>('/reciters/push', { method: 'POST', body: { nodeIds: [created.id] } });
          const row = result.applied.find((entry) => entry.seederId === created.id);
          filled = row?.error
            ? t('seeders.fillFailed', { error: row.error })
            : t('seeders.fillQueued', { count: String(row?.added ?? 0) });
        } catch (caught) {
          filled = t('seeders.fillFailed', {
            error: caught instanceof Error ? caught.message : '',
          });
        }
      }
      setMessage([t('seeders.added'), filled].filter(Boolean).join(' '));
      setNewFill(false);
      await load();
      // Next step is the node's own screen: the catalogue checklist is there,
      // already ticked for everything the new node is missing.
      navigate(`/torrents/${created.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('seeders.addFailed'));
    } finally {
      setBusy(null);
    }
  }

  function startEdit(seeder: Seeder): void {
    setEditing(seeder);
    setEditName(seeder.name);
    setEditUrl(seeder.url);
    setEditUser('');
    setEditPass('');
    setError(null);
  }

  async function saveEdit(): Promise<void> {
    if (!editing) return;
    setBusy('edit');
    setError(null);
    try {
      // Omitted credentials keep what is stored; that is how a name or URL edit
      // never silently wipes a working password.
      const body: Record<string, string> = { name: editName.trim(), url: editUrl.trim() };
      if (editUser.trim()) body.adminUser = editUser.trim();
      if (editPass) body.adminPass = editPass;
      await api(`/seeders/${editing.id}`, { method: 'PATCH', body });
      setEditing(null);
      setMessage(t('seeders.updated'));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('seeders.updateFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function clearCredentials(id: number): Promise<void> {
    setBusy(`clear-${id}`);
    setError(null);
    try {
      await api(`/seeders/${id}`, { method: 'PATCH', body: { adminUser: null, adminPass: null } });
      setMessage(t('seeders.credentialsCleared'));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('seeders.updateFailed'));
    } finally {
      setBusy(null);
    }
  }

  /**
   * Ask what a top-up would do, then show it. The dialog carries the plan, so the
   * operator sees which node receives how many recitations and what the 90% cap
   * will leave out — the question the button's own label cannot answer.
   */
  async function openComplete(): Promise<void> {
    setBusy('complete-plan');
    setError(null);
    setMessage(null);
    setCompleteNote(null);
    try {
      const next = await api<PushPlan>('/reciters/push/plan', { method: 'POST', body: {} });
      if (!next.nodes.some((node) => node.toAdd.length > 0)) {
        // Nothing to ask about: a dialog whose only answer is "nothing" is noise.
        setMessage(t('seeders.completeNothing'));
        return;
      }
      setPlan(next);
      setConfirmingComplete(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('seeders.completeFailed'));
    } finally {
      setBusy(null);
    }
  }

  /**
   * Top up every node with the published catalogue, stopping at 90 % of each
   * node's quota. The plan shown in the dialog is the plan acted on; the run only
   * recomputes server-side to stay safe, and its result is what gets reported.
   */
  async function makeComplete(): Promise<void> {
    if (!plan) return;
    setConfirmingComplete(false);
    setCompleting(true);
    setError(null);
    setMessage(null);
    setCompleteNote(null);
    try {
      const applied = await api<{ applied?: { added: number }[] }>('/reciters/push', {
        method: 'POST',
        body: {},
      });
      const added = (applied.applied ?? []).reduce((sum, row) => sum + row.added, 0);
      const skipped = plan.nodes.reduce((sum, row) => sum + row.skipped, 0);
      setMessage(t('seeders.completeDone', { added: String(added) }));
      if (skipped > 0) setCompleteNote(t('seeders.completeSkipped', { count: String(skipped) }));
      setPlan(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('seeders.completeFailed'));
    } finally {
      setCompleting(false);
    }
  }

  async function poll(id: number): Promise<void> {
    setBusy(`poll-${id}`);
    try {
      await api(`/seeders/${id}/poll`, { method: 'POST' });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('seeders.pollFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function pollAll(): Promise<void> {
    setBusy('poll-all');
    try {
      await api('/seeders/poll-all', { method: 'POST' });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('seeders.pollFailed'));
    } finally {
      setBusy(null);
    }
  }

  // Hooks stay above the early return. Coverage is null until the catalogue loads,
  // and "unknown" must never render as "complete".
  const coverage = useMemo(
    () =>
      catalogue && seeders
        ? missingPerNode(
            catalogue,
            seeders.map((seeder) => seeder.id),
          )
        : null,
    [catalogue, seeders],
  );
  const nothingToDo = coverage !== null && totalMissing(coverage) === 0;
  // An empty fleet is not "complete": the button would push to nobody, and the
  // panel below already says to add the first node.
  const noNodes = seeders !== null && seeders.length === 0;

  if (!user) return <p className="body muted">{t('seeders.signInRequired')}</p>;

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <h1 className="display-lg">{t('seeders.title')}</h1>
          <p className="body muted">{t('seeders.lede')}</p>
        </div>
        <div className="cluster">
          <Button
            variant="secondary"
            icon={<Icon name="refresh" />}
            onClick={() => void pollAll()}
            busy={busy === 'poll-all'}
          >
            {t('seeders.pollAll')}
          </Button>
          <Button
            variant="secondary"
            busy={busy === 'complete-plan' || completing}
            disabled={noNodes || nothingToDo}
            aria-describedby="complete-hint"
            onClick={() => void openComplete()}
          >
            {t('seeders.complete')}
          </Button>
          <Button icon={<Icon name="plus" />} onClick={() => setShowAdd(true)}>
            {t('seeders.add')}
          </Button>
        </div>
      </header>

      {/* The button's own sentence: what it does, in which direction, and what it
          leaves alone. It doubles as the reason the button is disabled. */}
      <p className="fine-print" id="complete-hint">
        {nothingToDo ? t('seeders.completeNothing') : t('seeders.completeHint')}
      </p>

      {error ? <Notice tone="bad">{error}</Notice> : null}
      {message ? <Notice tone="ok">{message}</Notice> : null}
      {completeNote ? (
        <Notice tone="notice">
          {completeNote}{' '}
          <Button small variant="tertiary" onClick={() => setCompleteNote(null)}>
            {t('seeders.dismiss')}
          </Button>
        </Notice>
      ) : null}

      {showAdd ? (
        <FormModal
          title={t('seeders.add')}
          submitLabel={t('seeders.addSubmit')}
          onSubmit={() => void add()}
          onClose={() => setShowAdd(false)}
          busy={busy === 'add'}
          disabled={!newName.trim() || !newUrl.trim()}
        >
          <Field label={t('seeders.name')}>
            {(id) => (
              <Input id={id} value={newName} onChange={(event) => setNewName(event.target.value)} />
            )}
          </Field>
          <Field label={t('seeders.url')} hint={t('seeders.urlHint')}>
            {(id) => (
              <Input
                id={id}
                value={newUrl}
                onChange={(event) => setNewUrl(event.target.value)}
                placeholder="http://192.168.1.100:8085"
              />
            )}
          </Field>
          <Field label={t('seeders.adminUser')} hint={t('seeders.credentialsHint')}>
            {(id) => (
              <Input id={id} value={newUser} onChange={(event) => setNewUser(event.target.value)} />
            )}
          </Field>
          <Field label={t('seeders.adminPass')}>
            {(id) => (
              <Input
                id={id}
                type="password"
                value={newPass}
                onChange={(event) => setNewPass(event.target.value)}
              />
            )}
          </Field>
          <div className="stack">
            <label className="cluster">
              <input
                type="checkbox"
                checked={newFill}
                onChange={(event) => setNewFill(event.target.checked)}
              />
              <span>{t('seeders.fillOnAdd')}</span>
            </label>
            <p className="fine-print">{t('seeders.fillOnAddHint')}</p>
          </div>

          {/* The same disclosure TURN uses, because "install it first" is the same
                problem: the command is copy-paste, and the password is printed once. */}
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
              {t('seeders.deployTitle')}
            </summary>
            <div className="stack" style={{ marginTop: 'var(--space-3)' }}>
              <p className="body muted">{t('seeders.deployHint')}</p>
              <CopyLine
                value={INSTALL_COMMAND}
                label={t('help.copy')}
                title={t('seeders.installTitle')}
                hint={t('seeders.installHint')}
              />
              <CopyLine
                value={FIREWALL_COMMAND}
                label={t('help.copy')}
                title={t('seeders.portsTitle')}
                hint={t('seeders.portsHint')}
              />
              <p className="fine-print">{t('seeders.deployNote')}</p>
              <a className="fine-print" {...linkProps('/help')}>
                {t('seeders.deployMore')}
              </a>
            </div>
          </details>
        </FormModal>
      ) : null}

      {editing ? (
        <FormModal
          title={`${t('seeders.editTitle')} — ${editing.name}`}
          submitLabel={t('common.save')}
          onSubmit={() => void saveEdit()}
          onClose={() => setEditing(null)}
          busy={busy === 'edit'}
          extra={
            editing.hasCredentials ? (
              <Button variant="destructive" onClick={() => void clearCredentials(editing.id)}>
                {t('seeders.clearCredentials')}
              </Button>
            ) : null
          }
        >
          <Field label={t('seeders.name')}>
            {(id) => (
              <Input
                id={id}
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
              />
            )}
          </Field>
          <Field label={t('seeders.url')} hint={t('seeders.urlHint')}>
            {(id) => (
              <Input id={id} value={editUrl} onChange={(event) => setEditUrl(event.target.value)} />
            )}
          </Field>
          <Field label={t('seeders.adminUser')} hint={t('seeders.credentialsKeepHint')}>
            {(id) => (
              <Input
                id={id}
                value={editUser}
                onChange={(event) => setEditUser(event.target.value)}
              />
            )}
          </Field>
          <Field label={t('seeders.adminPass')}>
            {(id) => (
              <Input
                id={id}
                type="password"
                value={editPass}
                onChange={(event) => setEditPass(event.target.value)}
              />
            )}
          </Field>
        </FormModal>
      ) : null}

      {confirmingComplete && plan ? (
        <ConfirmModal
          title={t('seeders.completeTitle')}
          body={
            <div className="stack stack--tight">
              <p className="body muted">{t('seeders.completeHint')}</p>
              <ul
                className="stack stack--tight"
                style={{ listStyle: 'none', margin: 0, padding: 0 }}
              >
                {plan.nodes.map((node) => (
                  <li key={node.seederId} className="cluster">
                    <span className="row__label">{node.name}</span>
                    {node.toAdd.length > 0 ? (
                      <Chip tone="ok">
                        {t('seeders.planNodeAdd', { count: node.toAdd.length })}
                      </Chip>
                    ) : null}
                    {node.skipped > 0 ? (
                      <Chip tone="notice">
                        {t('seeders.planNodeSkip', { count: node.skipped })}
                      </Chip>
                    ) : null}
                    {node.skipReason && node.skipReason !== 'low_space' ? (
                      <Chip tone="notice">{t('seeders.planSkipped')}</Chip>
                    ) : null}
                  </li>
                ))}
              </ul>
              {plan.nodes.some((node) => node.skipped > 0) ? (
                <p className="fine-print">{t('seeders.planCap')}</p>
              ) : null}
            </div>
          }
          confirmLabel={t('seeders.completeConfirm')}
          busy={completing}
          onClose={() => {
            setConfirmingComplete(false);
            setPlan(null);
          }}
          onConfirm={() => void makeComplete()}
        />
      ) : null}

      {seeders === null ? (
        <SkeletonRows rows={3} label={t('seeders.loading')} />
      ) : seeders.length === 0 ? (
        <Panel>
          <p className="body muted">{t('seeders.empty')}</p>
        </Panel>
      ) : (
        <div className="node-grid">
          {[...seeders]
            .sort((a, b) => Number(b.pinned) - Number(a.pinned))
            .map((seeder) => {
              // The card answers two questions: is it healthy, and how full is it.
              // Disk size is not one of them — the quota the operator set is.
              // A node that has never answered reports null, which is "unknown", not 0.
              const used = seeder.usedBytes;
              const quota = seeder.quotaBytes;
              const ratio = used !== null && quota !== null && quota > 0 ? used / quota : undefined;
              const metrics: NodeMetric[] = [
                {
                  label: t('seeders.quotaLabel'),
                  value: (
                    <bdi>
                      {used !== null && quota !== null && quota > 0
                        ? t('seeders.quota', {
                            used: bytes(used, locale),
                            quota: bytes(quota, locale),
                          })
                        : bytes(used, locale)}
                    </bdi>
                  ),
                  hint: quota === 0 ? t('seeders.quotaUnlimited') : undefined,
                  ratio,
                },
                {
                  label: t('seeders.traffic'),
                  value: `${t('seeders.torrentCount', {
                    count: seeder.torrentCount,
                  })} · ${t('seeders.peerCount', { count: seeder.peerCount })}`,
                },
                {
                  label: t('seeders.speed'),
                  value: (
                    <>
                      <bdi className="node-card__line">
                        <Icon name="up" />
                        {bytes(seeder.uploadSpeed, locale, true)}
                      </bdi>
                      <bdi className="node-card__line">
                        <Icon name="down" />
                        {bytes(seeder.downloadSpeed, locale, true)}
                      </bdi>
                    </>
                  ),
                },
                {
                  label: t('seeders.versionLabel'),
                  value: seeder.version ? `v${seeder.version}` : t('seeders.versionUnknown'),
                  hint:
                    seeder.version && seeder.desiredVersion ? (
                      seeder.version === seeder.desiredVersion ? (
                        <Chip tone="ok">{t('seeders.upToDate')}</Chip>
                      ) : (
                        <Chip tone="notice">
                          {t('seeders.behind', { version: seeder.desiredVersion })}
                        </Chip>
                      )
                    ) : undefined,
                },
              ];
              return (
                <NodeCard
                  key={seeder.id}
                  title={seeder.name}
                  href={`/torrents/${seeder.id}`}
                  url={seeder.url}
                  pinned={seeder.pinned}
                  statusTone={statusTone(seeder.status)}
                  statusLabel={t(statusKey(seeder.status))}
                  badges={
                    seeder.pinned ? <Chip tone="info">{t('seeders.pinned')}</Chip> : undefined
                  }
                  note={t('seeders.credentialsNote', {
                    state: t(
                      seeder.hasCredentials
                        ? 'seeders.credentialsSet'
                        : 'seeders.credentialsMissing',
                    ),
                  })}
                  metrics={metrics}
                  actions={
                    <>
                      <Button
                        small
                        variant="secondary"
                        onClick={() => navigate(`/torrents/${seeder.id}`)}
                      >
                        {t('seeders.manage')}
                      </Button>
                      <Button
                        small
                        variant="secondary"
                        icon={<Icon name="refresh" />}
                        onClick={() => void poll(seeder.id)}
                        busy={busy === `poll-${seeder.id}`}
                      >
                        {t('seeders.probe')}
                      </Button>
                      <Button small variant="tertiary" onClick={() => startEdit(seeder)}>
                        {t('seeders.edit')}
                      </Button>
                    </>
                  }
                />
              );
            })}
        </div>
      )}
    </div>
  );
}
