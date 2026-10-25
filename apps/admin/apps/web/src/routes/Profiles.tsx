import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { api } from '../lib/api';
import { navigate } from '../lib/router';
import { useI18n } from '../lib/i18n';
import type { BootstrapPrompt, GeneratedProfile, ImportPreview, Profile } from '../lib/types';
import { Button } from '../components/Button';
import { AsyncButton } from '../components/AsyncButton';
import { Icon } from '../components/icons';
import { Field, Input, TextArea } from '../components/Field';
import { Chip, Notice } from '../components/Chip';
import { Panel, Row } from '../components/Panel';
import { Modal } from '../components/Modal';
import { SkeletonRows } from '../components/Skeleton';
import { Tabs } from '../components/Tabs';

/**
 * The profile list. Rows follow the Notes pattern — name, then the identity, then
 * when it last changed — and the row itself is the click target.
 */
export function Profiles(): ReactElement {
  const { t } = useI18n();
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [samples, setSamples] = useState('');
  const [preview, setPreview] = useState<GeneratedProfile | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // ---- bootstrap prompt ----
  const [bootstrapTab, setBootstrapTab] = useState<'paste' | 'mcp'>('paste');
  const [bootstrapPrompt, setBootstrapPrompt] = useState<BootstrapPrompt | null>(null);
  const [bootstrapPromptError, setBootstrapPromptError] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');
  const [checking, setChecking] = useState(false);
  const [bootstrapPreview, setBootstrapPreview] = useState<ImportPreview | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [savingBootstrap, setSavingBootstrap] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      setProfiles(await api<Profile[]>('/profiles'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('profiles.loadFailed'));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void api<BootstrapPrompt>('/me/bootstrap-prompt')
      .then(setBootstrapPrompt)
      .catch((caught) =>
        setBootstrapPromptError(
          caught instanceof Error ? caught.message : t('bootstrap.loadFailed'),
        ),
      );
  }, [t]);

  const resetForm = (): void => {
    setCreating(false);
    setName('');
    setSamples('');
    setPreview(null);
    setFormError(null);
  };

  const generate = async (): Promise<void> => {
    setFormError(null);
    setBusy(true);
    try {
      setPreview(
        await api<GeneratedProfile>('/profiles/generate', {
          method: 'POST',
          body: { name, samples: [samples] },
        }),
      );
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : t('profiles.generationFailed'));
    } finally {
      setBusy(false);
    }
  };

  const apply = async (): Promise<void> => {
    setFormError(null);
    setBusy(true);
    try {
      await api<Profile>('/profiles/from-samples', {
        method: 'POST',
        body: { name, samples: [samples], isDefault: profiles?.length === 0 },
      });
      resetForm();
      await load();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : t('profiles.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const setDefault = async (id: number): Promise<void> => {
    await api(`/profiles/${id}/default`, { method: 'POST' });
    await load();
  };

  const remove = async (profile: Profile): Promise<void> => {
    const typed = window.prompt(t('profiles.deletePrompt', { name: profile.name }));
    if (typed !== profile.name) return;
    try {
      await api(`/profiles/${profile.id}`, { method: 'DELETE' });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('profiles.deleteFailed'));
    }
  };

  const sampleCount = (count: number): string =>
    count === 1 ? t('profiles.samplesOne') : t('profiles.samples', { count });

  const copyPrompt = async (): Promise<void> => {
    const text = bootstrapTab === 'mcp' ? bootstrapPrompt?.mcp : bootstrapPrompt?.paste;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be denied; the block stays selectable */
    }
  };

  const checkPasted = async (): Promise<void> => {
    setBootstrapError(null);
    setBootstrapPreview(null);

    // The most common failure is not a malformed object: it is a reply that answers with
    // prose ("paste two or three samples…") because the agent ignored the instruction.
    // The server says "no JSON object found", which names the parser, not the next step.
    if (!pasted.includes('{')) {
      setBootstrapError(t('bootstrap.notJson'));
      return;
    }

    setChecking(true);
    try {
      setBootstrapPreview(
        await api<ImportPreview>('/profiles/import', {
          method: 'POST',
          body: { promptVersion: bootstrapPrompt?.promptVersion ?? 1, text: pasted },
        }),
      );
    } catch (caught) {
      setBootstrapError(caught instanceof Error ? caught.message : t('bootstrap.checkFailed'));
    } finally {
      setChecking(false);
    }
  };

  const saveBootstrap = async (): Promise<void> => {
    if (!bootstrapPreview) return;
    setSavingBootstrap(true);
    setBootstrapError(null);
    try {
      await api('/profiles/import/apply', {
        method: 'POST',
        body: { promptVersion: bootstrapPrompt?.promptVersion ?? 1, text: pasted },
      });
      setPasted('');
      setBootstrapPreview(null);
      await load();
    } catch (caught) {
      setBootstrapError(caught instanceof Error ? caught.message : t('bootstrap.saveFailed'));
    } finally {
      setSavingBootstrap(false);
    }
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="display-lg">{t('profiles.title')}</h1>
          <p className="body muted">{t('profiles.lede')}</p>
        </div>
      </div>

      {error ? <Notice tone="bad">{error}</Notice> : null}

      {profiles === null ? (
        <SkeletonRows rows={3} label={t('profiles.title')} />
      ) : profiles.length === 0 ? (
        <Panel tone="parchment">
          <div className="empty">{t('profiles.empty')}</div>
          <div className="cluster cluster--center">
            <Button icon={<Icon name="plus" />} onClick={() => setCreating(true)}>
              {t('profiles.new')}
            </Button>
          </div>
        </Panel>
      ) : (
        <Panel>
          <div className="panel-head">
            <h2 className="panel__title">
              {t('profiles.listTitle')} <Chip tone="info">{String(profiles.length)}</Chip>
            </h2>
            <Button icon={<Icon name="plus" />} small onClick={() => setCreating(true)}>
              {t('profiles.new')}
            </Button>
          </div>
          <div className="rows">
            {profiles.map((profile) => (
              <Row
                key={profile.id}
                label={
                  <span className="cluster">
                    {profile.name}
                    {profile.isDefault ? <Chip tone="info">{t('profiles.default')}</Chip> : null}
                  </span>
                }
                identifier={t('profiles.clientAsks', {
                  name: String(profile.manifest.name ?? profile.name),
                })}
                meta={`v${String(profile.manifest.version ?? '—')} · ${sampleCount(
                  profile.sampleCount,
                )} · ${profile.houseStyle ? t('profiles.houseStyleSet') : t('profiles.noHouseStyle')}`}
                onClick={() => navigate(`/profiles/${profile.id}`)}
                trailing={
                  <span className="cluster">
                    {!profile.isDefault ? (
                      <Button
                        variant="tertiary"
                        small
                        onClick={(event) => {
                          event.stopPropagation();
                          void setDefault(profile.id);
                        }}
                      >
                        {t('profiles.makeDefault')}
                      </Button>
                    ) : null}
                    <Button
                      variant="destructive"
                      small
                      onClick={(event) => {
                        event.stopPropagation();
                        void remove(profile);
                      }}
                    >
                      {t('profiles.delete')}
                    </Button>
                  </span>
                }
              />
            ))}
          </div>
        </Panel>
      )}

      {creating ? (
        <Modal title={t('profiles.modalTitle')} onClose={resetForm} dismissible={!busy}>
          <div className="stack">
            <Field label={t('common.name')} hint={t('profiles.nameHint')} error={formError}>
              {(id) => (
                <Input id={id} value={name} onChange={(event) => setName(event.target.value)} />
              )}
            </Field>
            <Field label={t('profiles.samplesLabel')} hint={t('profiles.samplesHint')}>
              {(id) => (
                <TextArea
                  id={id}
                  value={samples}
                  onChange={(event) => setSamples(event.target.value)}
                  placeholder={'---\nname: my-voice\n---\n\nI write short sentences…'}
                />
              )}
            </Field>

            {preview ? (
              <div className="stack stack--tight">
                <div className="cluster">
                  <Chip tone={preview.excluded.length > 0 ? 'notice' : 'ok'}>
                    {preview.excluded.length === 1
                      ? t('profiles.droppedOne')
                      : t('profiles.dropped', { count: preview.excluded.length })}
                  </Chip>
                </div>
                {preview.excluded.length > 0 ? (
                  <pre className="code-line">
                    {preview.excluded
                      .map(
                        (line) =>
                          `${String(line.line).padStart(3)}  ${line.why}\n     ${line.text}`,
                      )
                      .join('\n')}
                  </pre>
                ) : null}
                <p className="fine-print">
                  {t('profiles.filesWritten', {
                    files: preview.files.map((file) => file.name).join(', '),
                  })}
                </p>
              </div>
            ) : null}

            <div className="cluster">
              {preview ? (
                <Button onClick={() => void apply()} busy={busy}>
                  {t('profiles.apply')}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => void generate()}
                  busy={busy}
                  disabled={!name || !samples}
                >
                  {t('profiles.preview')}
                </Button>
              )}
              <Button variant="secondary" onClick={resetForm} disabled={busy}>
                {t('common.cancel')}
              </Button>
              {preview ? <span className="fine-print">{t('profiles.applyHint')}</span> : null}
            </div>
          </div>
        </Modal>
      ) : null}

      <Panel>
        <div className="stack">
          <div>
            <h2 className="panel__title">{t('bootstrap.title')}</h2>
            <p className="body muted">{t('bootstrap.lede')}</p>
          </div>

          {bootstrapPromptError ? <Notice tone="bad">{bootstrapPromptError}</Notice> : null}

          <Tabs
            items={[
              { id: 'paste' as const, label: t('bootstrap.tabPaste') },
              { id: 'mcp' as const, label: t('bootstrap.tabMcp') },
            ]}
            active={bootstrapTab}
            onChange={setBootstrapTab}
            label={t('bootstrap.title')}
            idPrefix="bootstrap-"
          />

          <div className="stack stack--tight">
            <pre className="prompt-block">
              {bootstrapTab === 'mcp' ? bootstrapPrompt?.mcp : bootstrapPrompt?.paste}
            </pre>
            <div className="cluster">
              <Button
                variant="secondary"
                icon={<Icon name="copy" />}
                onClick={() => void copyPrompt()}
              >
                {copied ? t('bootstrap.copied') : t('keys.copy')}
              </Button>
            </div>
            <p className="fine-print">{t('bootstrap.privacy')}</p>
          </div>

          <Field label={t('bootstrap.pasteLabel')} hint={t('bootstrap.pasteHint')}>
            {(id) => (
              <TextArea
                id={id}
                rows={6}
                value={pasted}
                onChange={(event) => setPasted(event.target.value)}
              />
            )}
          </Field>

          {bootstrapError ? <Notice tone="bad">{bootstrapError}</Notice> : null}

          {bootstrapPreview ? (
            <div className="stack stack--tight">
              <Notice tone={bootstrapPreview.excluded.length > 0 ? 'notice' : 'ok'}>
                {t('bootstrap.checked', { name: String(bootstrapPreview.manifest.name) })}
              </Notice>
              {bootstrapPreview.nameTaken ? (
                <Notice tone="bad">
                  {t('bootstrap.nameTaken', { name: String(bootstrapPreview.manifest.name) })}
                </Notice>
              ) : null}
              {bootstrapPreview.warnings.length > 0 ? (
                <div className="stack stack--tight">
                  <p className="fine-print">{t('bootstrap.warningsTitle')}</p>
                  {bootstrapPreview.warnings.map((warning) => (
                    <p key={warning} className="fine-print">
                      {warning}
                    </p>
                  ))}
                </div>
              ) : null}
              {bootstrapPreview.excluded.length > 0 ? (
                <div className="stack stack--tight">
                  <p className="fine-print">{t('bootstrap.excludedTitle')}</p>
                  {bootstrapPreview.excluded.map((entry, index) => (
                    <p key={index} className="fine-print">
                      {entry.field}: {entry.why}
                    </p>
                  ))}
                </div>
              ) : null}
              <AsyncButton
                onClick={() => void saveBootstrap()}
                disabled={bootstrapPreview.nameTaken}
                busy={savingBootstrap}
              >
                {t('bootstrap.save')}
              </AsyncButton>
            </div>
          ) : (
            <div className="cluster">
              <Button onClick={() => void checkPasted()} busy={checking} disabled={!pasted.trim()}>
                {t('bootstrap.check')}
              </Button>
            </div>
          )}
        </div>
      </Panel>

      {profiles && profiles.length > 0 ? (
        <p className="fine-print">
          {t('profiles.defaultFooter', {
            name: profiles.find((profile) => profile.isDefault)?.name ?? t('profiles.none'),
          })}
        </p>
      ) : null}
    </div>
  );
}
