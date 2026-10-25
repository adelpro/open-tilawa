import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { api } from '../lib/api';
import { navigate } from '../lib/router';
import { useI18n } from '../lib/i18n';
import type { MessageKey } from '../lib/i18n';
import { useSession } from '../lib/session';
import { TOOLCHAIN_BUILTINS, type Profile, type ToolchainStepSimple } from '../lib/types';
import { Button } from '../components/Button';
import { Chip, Notice } from '../components/Chip';
import { Field, Input, TextArea } from '../components/Field';
import { Icon } from '../components/icons';
import { SkeletonHeading, SkeletonRows } from '../components/Skeleton';
import { Tabs } from '../components/Tabs';

type EditorTab = 'general' | 'toolchain' | 'voice';
type StepKind = 'gate' | 'prompt' | 'master';
type MasterMode = 'none' | 'bundled' | 'custom';

/** A step as the chain list holds it. Built-ins carry an id; local steps do not. */
interface ChainStep {
  /** Stable react key; the id for a built-in, `local-N` for an authored step. */
  key: string;
  id: string | null;
  kind: Exclude<StepKind, 'master'>;
  name: string;
  body: string;
}

interface PaneErrors {
  manifest?: string;
  houseStyle?: string;
}

interface StepErrors {
  name?: string;
  body?: string;
}

const BUILTIN_KIND: Record<string, Exclude<StepKind, 'master'>> = {
  'avoid-ai-writing': 'gate',
  'remove-ai-marks': 'gate',
  fasaha: 'prompt',
};

const KIND_LABEL: Record<StepKind, MessageKey> = {
  gate: 'editor.kind.gate',
  prompt: 'editor.kind.prompt',
  master: 'editor.kind.master',
};

const MASTER_HINT: Record<MasterMode, MessageKey> = {
  none: 'editor.master.noneHint',
  bundled: 'editor.master.bundledHint',
  custom: 'editor.master.customHint',
};

/** The three built-ins a profile can add; `voice-tune` is the master slot instead. */
const CHAIN_BUILTINS = TOOLCHAIN_BUILTINS.filter((id) => id !== 'voice-tune');

const nameOf = (id: string): string => id;

/**
 * The editor: three panes over one save bar.
 *
 * General is the manifest and the house style as JSON, because that is what they are.
 * Toolchain is the ordered chain — add, reorder, remove — never a JSON array: the order
 * is the meaning, and an array literal hides it. Voice is the card a client reads and
 * the master pass, which is the one step that runs after every other.
 *
 * Saving is one action, not one per pane — the API writes the profile as a whole.
 */
export function ProfileEditor({ id }: { id: number }): ReactElement {
  const { t } = useI18n();
  const { user } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState<EditorTab>('general');
  const [manifest, setManifest] = useState('');
  const [houseStyle, setHouseStyle] = useState('');
  const [chain, setChain] = useState<ChainStep[]>([]);
  const [off, setOff] = useState<string[]>([]);
  const [masterMode, setMasterMode] = useState<MasterMode>('none');
  const [masterName, setMasterName] = useState('');
  const [masterBody, setMasterBody] = useState('');
  const [masterErrors, setMasterErrors] = useState<StepErrors>({});

  const [errors, setErrors] = useState<PaneErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  // The add/edit form for an authored step: one form, two states.
  const [form, setForm] = useState<{ key: string | null; name: string; body: string } | null>(null);
  const [formErrors, setFormErrors] = useState<StepErrors>({});

  const load = useCallback(async () => {
    try {
      const loaded = await api<Profile>(`/profiles/${id}`);
      const steps = loaded.toolchain ?? [];
      setProfile(loaded);
      setManifest(JSON.stringify(loaded.manifest, null, 2));
      setHouseStyle(JSON.stringify(loaded.houseStyle ?? {}, null, 2));

      const next: ChainStep[] = [];
      steps.forEach((step, index) => {
        if (step.kind === 'master') return;
        if (step.id !== null && !step.enabled) return;
        next.push({
          key: step.id !== null ? `builtin:${step.id}` : `local:${index}`,
          id: step.id,
          kind: step.kind === 'gate' ? 'gate' : 'prompt',
          name: step.name ?? step.id ?? '',
          body: step.body ?? '',
        });
      });
      setChain(next);
      setOff(
        CHAIN_BUILTINS.filter(
          (builtin) => !steps.some((step) => step.id === builtin && step.enabled),
        ),
      );

      const master = steps.find((step) => step.kind === 'master');
      if (!master) {
        setMasterMode('none');
        setMasterName('');
        setMasterBody('');
      } else if (master.id === 'voice-tune') {
        setMasterMode('bundled');
      } else {
        setMasterMode('custom');
        setMasterName(master.name ?? '');
        setMasterBody(master.body ?? '');
      }

      setDirty(false);
      setSaved(false);
      setErrors({});
      setMasterErrors({});
      setError(null);
      setForm(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('editor.loadFailed'));
    }
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const touch = (): void => {
    setDirty(true);
    setSaved(false);
  };

  const save = async (): Promise<void> => {
    setError(null);
    setSaved(false);

    // Parse each pane separately. A single try/catch can only say "one of them",
    // which is the message this screen used to give while the cursor sat in the
    // right place and nothing pointed at it.
    const found: PaneErrors = {};
    let parsedManifest: unknown;
    let parsedHouse: unknown;

    try {
      parsedManifest = JSON.parse(manifest);
    } catch {
      found.manifest = t('editor.manifestInvalid');
    }
    try {
      parsedHouse = JSON.parse(houseStyle);
    } catch {
      found.houseStyle = t('editor.houseStyleInvalid');
    }
    setErrors(found);

    if (found.manifest || found.houseStyle) {
      setTab('general');
      return;
    }

    if (masterMode === 'custom') {
      const master: StepErrors = {};
      const name = masterName.trim();
      if (!name || name.length > 40) master.name = t('editor.step.nameRequired');
      if (!masterBody.trim()) master.body = t('editor.step.bodyRequired');
      else if (masterBody.length > 4_000) master.body = t('editor.step.bodyLong');
      setMasterErrors(master);
      if (master.name || master.body) {
        setTab('voice');
        return;
      }
    }

    // The chain the profile keeps: enabled steps in the order shown, then the
    // built-ins that are switched off (so the toggle survives a save), then the
    // master — which is always last because it composes everything above it.
    const toolchain: ToolchainStepSimple[] = [
      ...chain.map((step) => ({
        id: step.id,
        name: step.name,
        kind: step.kind,
        enabled: true,
        ...(step.body ? { body: step.body } : {}),
      })),
      ...off.map((builtin) => ({
        id: builtin,
        name: nameOf(builtin),
        kind: BUILTIN_KIND[builtin] ?? 'prompt',
        enabled: false,
      })),
    ];
    if (masterMode === 'bundled') {
      toolchain.push({ id: 'voice-tune', name: 'voice-tune', kind: 'master', enabled: true });
    } else if (masterMode === 'custom') {
      toolchain.push({
        id: null,
        name: masterName.trim(),
        kind: 'master',
        enabled: true,
        body: masterBody,
      });
    }

    setBusy(true);
    try {
      await api<Profile>(`/profiles/${id}`, {
        method: 'PATCH',
        body: { manifest: parsedManifest, houseStyle: parsedHouse, toolchain },
      });
      await load();
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('profiles.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const openAdd = (): void => {
    setForm({ key: null, name: '', body: '' });
    setFormErrors({});
  };

  const openEdit = (step: ChainStep): void => {
    setForm({ key: step.key, name: step.name, body: step.body });
    setFormErrors({});
  };

  const submitForm = (): void => {
    if (!form) return;
    const name = form.name.trim();
    const found: StepErrors = {};
    if (!name || name.length > 40) found.name = t('editor.step.nameRequired');
    if (!form.body.trim()) found.body = t('editor.step.bodyRequired');
    else if (form.body.length > 4_000) found.body = t('editor.step.bodyLong');
    setFormErrors(found);
    if (found.name || found.body) return;

    if (form.key) {
      setChain((current) =>
        current.map((step) => (step.key === form.key ? { ...step, name, body: form.body } : step)),
      );
    } else {
      const key = `local:${Date.now()}`;
      setChain((current) => [...current, { key, id: null, kind: 'prompt', name, body: form.body }]);
    }
    setForm(null);
    setFormErrors({});
    touch();
  };

  const move = (index: number, by: -1 | 1): void => {
    setChain((current) => {
      const next = [...current];
      const target = index + by;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    touch();
  };

  const remove = (step: ChainStep): void => {
    setChain((current) => current.filter((entry) => entry.key !== step.key));
    if (step.id && (CHAIN_BUILTINS as readonly string[]).includes(step.id)) {
      setOff((current) => [...current, step.id as string]);
    }
    if (form?.key === step.key) setForm(null);
    touch();
  };

  const addBuiltin = (builtin: string): void => {
    setChain((current) => [
      ...current,
      {
        key: `builtin:${builtin}`,
        id: builtin,
        kind: BUILTIN_KIND[builtin] ?? 'prompt',
        name: builtin,
        body: '',
      },
    ]);
    setOff((current) => current.filter((entry) => entry !== builtin));
    touch();
  };

  const tabs: { id: EditorTab; label: string }[] = [
    { id: 'general', label: t('editor.tab.general') },
    { id: 'toolchain', label: t('editor.tab.toolchain') },
    { id: 'voice', label: t('editor.tab.voice') },
  ];

  if (!profile) {
    // The heading is the same shape whether or not the row has arrived, so the page does
    // not jump when it does.
    return (
      <div className="stack">
        {error ? (
          <Notice tone="bad">{error}</Notice>
        ) : (
          <>
            <SkeletonHeading />
            <SkeletonRows rows={2} label={t('app.loading')} />
          </>
        )}
      </div>
    );
  }

  const total = chain.length + off.length + (masterMode === 'none' ? 0 : 1);
  const atLimit = total >= 12;
  const kindLabel = (kind: StepKind): string => t(KIND_LABEL[kind]);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="display-lg">{profile.name}</h1>
          <p className="body muted">
            <Chip tone="info">
              {profile.isDefault ? t('profiles.default') : t('profiles.notDefault')}
            </Chip>{' '}
            {profile.sampleCount === 1
              ? t('profiles.samplesOne')
              : t('profiles.samples', { count: profile.sampleCount })}
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/')}>
          {t('common.back')}
        </Button>
      </div>

      {error ? <Notice tone="bad">{error}</Notice> : null}

      <Tabs
        items={tabs}
        active={tab}
        onChange={setTab}
        label={t('editor.tabs')}
        idPrefix="editor-"
      />

      <div
        id={`editor-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`editor-tab-${tab}`}
        className="editor-pane"
      >
        {tab === 'general' ? (
          <div className="stack">
            <p className="fine-print">{t('editor.jsonNote')}</p>
            <Field
              label={t('editor.manifest')}
              hint={t('editor.manifestHint')}
              error={errors.manifest}
            >
              {(fieldId) => (
                <TextArea
                  id={fieldId}
                  name="manifest"
                  autoComplete="off"
                  value={manifest}
                  onChange={(event) => {
                    setManifest(event.target.value);
                    touch();
                    if (errors.manifest) setErrors({ ...errors, manifest: undefined });
                  }}
                  rows={16}
                />
              )}
            </Field>
            <Field
              label={t('editor.houseStyle')}
              hint={t('editor.houseStyleHint')}
              error={errors.houseStyle}
            >
              {(fieldId) => (
                <TextArea
                  id={fieldId}
                  name="house-style"
                  autoComplete="off"
                  value={houseStyle}
                  onChange={(event) => {
                    setHouseStyle(event.target.value);
                    touch();
                    if (errors.houseStyle) setErrors({ ...errors, houseStyle: undefined });
                  }}
                  rows={16}
                />
              )}
            </Field>
          </div>
        ) : null}

        {tab === 'toolchain' ? (
          <div className="stack">
            <div>
              <h2 className="display-sm">{t('editor.chain.title')}</h2>
              <p className="fine-print">{t('editor.chain.hint')}</p>
            </div>

            {chain.length === 0 && masterMode === 'none' ? (
              <p className="body muted">{t('editor.chain.empty')}</p>
            ) : (
              <ul className="chain">
                {chain.map((step, index) => (
                  <li key={step.key} className="chain__row">
                    <div className="chain__main">
                      <span className="chain__name">
                        {step.name}
                        <Chip tone={step.kind === 'gate' ? 'info' : 'notice'}>
                          {kindLabel(step.kind)}
                        </Chip>
                        {step.id ? (
                          <span className="fine-print">{t('editor.chain.bundled')}</span>
                        ) : null}
                      </span>
                      {step.body ? <p className="fine-print chain__body">{step.body}</p> : null}
                    </div>
                    <div className="chain__actions">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={t('editor.chain.up')}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <Icon name="up" />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={t('editor.chain.down')}
                        disabled={index === chain.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <Icon name="down" />
                      </button>
                      {step.id === null ? (
                        <Button variant="tertiary" small onClick={() => openEdit(step)}>
                          {t('editor.chain.edit')}
                        </Button>
                      ) : null}
                      <Button variant="tertiary" small onClick={() => remove(step)}>
                        {t('editor.chain.remove')}
                      </Button>
                    </div>
                  </li>
                ))}
                {masterMode !== 'none' ? (
                  <li className="chain__row chain__row--master">
                    <div className="chain__main">
                      <span className="chain__name">
                        {masterMode === 'bundled' ? 'voice-tune' : masterName || '—'}
                        <Chip tone="ok">{kindLabel('master')}</Chip>
                        <span className="fine-print">{t('editor.chain.last')}</span>
                      </span>
                    </div>
                    <div className="chain__actions">
                      <Button variant="tertiary" small onClick={() => setTab('voice')}>
                        {t('editor.chain.edit')}
                      </Button>
                    </div>
                  </li>
                ) : null}
              </ul>
            )}

            {form ? (
              <div className="step-form">
                <h3 className="display-sm">
                  {form.key ? t('editor.chain.editTitle') : t('editor.chain.addTitle')}
                </h3>
                <Field label={t('editor.chain.name')} error={formErrors.name}>
                  {(fieldId) => (
                    <Input
                      id={fieldId}
                      value={form.name}
                      autoFocus
                      onChange={(event) => {
                        setForm({ ...form, name: event.target.value });
                        if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
                      }}
                    />
                  )}
                </Field>
                <Field
                  label={t('editor.chain.body')}
                  hint={t('editor.chain.bodyHint')}
                  error={formErrors.body}
                >
                  {(fieldId) => (
                    <TextArea
                      id={fieldId}
                      rows={5}
                      value={form.body}
                      onChange={(event) => {
                        setForm({ ...form, body: event.target.value });
                        if (formErrors.body) setFormErrors({ ...formErrors, body: undefined });
                      }}
                    />
                  )}
                </Field>
                <div className="cluster">
                  <Button onClick={submitForm}>{t('editor.chain.save')}</Button>
                  <Button variant="secondary" onClick={() => setForm(null)}>
                    {t('common.cancel')}
                  </Button>
                  <span className="fine-print">{t('editor.step.lengthHint')}</span>
                </div>
              </div>
            ) : (
              <div className="cluster">
                <Button
                  variant="secondary"
                  icon={<Icon name="plus" />}
                  disabled={atLimit}
                  onClick={openAdd}
                >
                  {t('editor.chain.add')}
                </Button>
                {atLimit ? <span className="fine-print">{t('editor.chain.limit')}</span> : null}
              </div>
            )}

            <div className="stack stack--tight">
              <h2 className="display-sm">{t('editor.chain.available')}</h2>
              <p className="fine-print">{t('editor.chain.availableHint')}</p>
              {off.length === 0 ? (
                <p className="fine-print">{t('editor.chain.noneAvailable')}</p>
              ) : (
                <div className="cluster">
                  {off.map((builtin) => (
                    <Button
                      key={builtin}
                      variant="secondary"
                      small
                      icon={<Icon name="plus" />}
                      disabled={atLimit}
                      onClick={() => addBuiltin(builtin)}
                    >
                      {builtin}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {tab === 'voice' ? (
          <div className="stack">
            <div>
              <h2 className="display-sm">{t('editor.voiceCard')}</h2>
              <p className="fine-print">{t('editor.voiceCardHint')}</p>
            </div>
            <pre className="code-line" style={{ whiteSpace: 'pre-wrap', font: 'var(--body)' }}>
              {profile.voiceCard ?? t('editor.noVoiceCard')}
            </pre>

            <div>
              <h2 className="display-sm">{t('editor.master.title')}</h2>
              <p className="fine-print">{t('editor.master.hint')}</p>
            </div>

            <div className="cluster" role="group" aria-label={t('editor.master.title')}>
              {(['none', 'bundled', 'custom'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={masterMode === mode}
                  className={`chip ${masterMode === mode ? 'chip--ok' : 'chip--notice'}`}
                  onClick={() => {
                    setMasterMode(mode);
                    setMasterErrors({});
                    touch();
                  }}
                >
                  {t(`editor.master.${mode}`)}
                </button>
              ))}
            </div>
            <p className="fine-print">{t(MASTER_HINT[masterMode])}</p>
            {masterMode === 'none' ? (
              <p className="fine-print">
                {user?.masterName
                  ? t('editor.master.accountNamed', { name: user.masterName })
                  : t('editor.master.accountNone')}
              </p>
            ) : null}

            {masterMode === 'custom' ? (
              <div className="step-form">
                <Field label={t('editor.master.name')} error={masterErrors.name}>
                  {(fieldId) => (
                    <Input
                      id={fieldId}
                      value={masterName}
                      onChange={(event) => {
                        setMasterName(event.target.value);
                        touch();
                        if (masterErrors.name)
                          setMasterErrors({ ...masterErrors, name: undefined });
                      }}
                    />
                  )}
                </Field>
                <Field
                  label={t('editor.master.body')}
                  hint={t('editor.master.bodyHint')}
                  error={masterErrors.body}
                >
                  {(fieldId) => (
                    <TextArea
                      id={fieldId}
                      rows={8}
                      value={masterBody}
                      onChange={(event) => {
                        setMasterBody(event.target.value);
                        touch();
                        if (masterErrors.body)
                          setMasterErrors({ ...masterErrors, body: undefined });
                      }}
                    />
                  )}
                </Field>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="editor-actions">
        <span className="fine-print" aria-live="polite">
          {dirty ? t('editor.unsaved') : saved ? t('prefs.saved') : ''}
        </span>
        <span className="cluster">
          {dirty ? (
            <Button variant="tertiary" onClick={() => void load()} disabled={busy}>
              {t('editor.discard')}
            </Button>
          ) : null}
          <Button onClick={() => void save()} busy={busy} disabled={!dirty}>
            {busy ? t('common.saving') : t('editor.saveChanges')}
          </Button>
        </span>
      </div>
    </div>
  );
}
