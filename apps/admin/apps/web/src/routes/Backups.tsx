import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { useI18n } from '../lib/i18n';
import type { MessageKey } from '../lib/i18n';
import { bytes, relative } from '../lib/format';
import { Button } from '../components/Button';
import { Panel, Row } from '../components/Panel';
import { Chip, Notice } from '../components/Chip';
import { SkeletonRows } from '../components/Skeleton';

interface Snapshot {
  name: string;
  bytes: number;
  mtime: string;
}

interface Overview {
  configured: boolean;
  directory: string;
  staleHours: number;
  stale: boolean;
  state: 'unmounted' | 'missing' | 'ok' | 'pending' | 'failed';
  generatedAt: string | null;
  error: string | null;
  local: (Snapshot & { ageHours: number }) | null;
  remote: {
    state: string | null;
    lastOkAt: string | null;
    lastOkFile: string | null;
    ageHours: number | null;
    verifiedAt?: string | null;
    verifiedError?: string | null;
  } | null;
  files: Snapshot[];
}

const STATE_KEY: Record<Overview['state'], MessageKey> = {
  ok: 'backups.state.ok',
  pending: 'backups.state.pending',
  failed: 'backups.state.failed',
  missing: 'backups.state.missing',
  unmounted: 'backups.state.unmounted',
};

const STATE_TONE = {
  ok: 'ok',
  pending: 'notice',
  failed: 'bad',
  missing: 'notice',
  unmounted: 'bad',
} as const;

/**
 * The catalogue's copies, as the host job left them.
 *
 * Nothing here takes a backup: the timer on the host owns the database, the lock and
 * the ssh key. This page answers the two questions that matter — when was the last
 * copy taken, and is there a second one somewhere else — because a backup that
 * stopped running is invisible until the day it is needed.
 */
export function Backups(): ReactElement {
  const { user } = useSession();
  const { t, locale } = useI18n();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runBusy, setRunBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api<Overview>('/backups'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('backups.state.failed'));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Start a run and wait for it. The job already refuses to overlap, so pressing twice
   * is harmless: the second run exits as "already running" rather than dumping twice.
   */
  async function runNow(): Promise<void> {
    setRunBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api<{ started: boolean; output: string }>('/backups/run', {
        method: 'POST',
      });
      if (result.started) {
        setNotice(t('backups.runStarted'));
        await load();
      } else {
        setError(t('backups.runFailed', { error: result.output.slice(-300) }));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('backups.state.failed'));
    } finally {
      setRunBusy(false);
    }
  }

  if (!user) return <p className="body muted">{t('backups.signInRequired')}</p>;

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <h1 className="display-lg">{t('backups.title')}</h1>
          <p className="body muted">{t('backups.lede')}</p>
        </div>
        <div className="cluster">
          {data ? <Chip tone={STATE_TONE[data.state]}>{t(STATE_KEY[data.state])}</Chip> : null}
          <Button busy={runBusy} onClick={() => void runNow()}>
            {t('backups.runNow')}
          </Button>
        </div>
      </header>

      {error ? <Notice tone="bad">{error}</Notice> : null}
      {notice ? <Notice tone="ok">{notice}</Notice> : null}
      {data && !data.configured ? <Notice tone="warn">{t('backups.unmounted')}</Notice> : null}
      {data?.configured && data.stale ? <Notice tone="bad">{t('backups.stale')}</Notice> : null}
      {data?.error ? (
        <Notice tone="warn">
          {t('backups.error')}: {data.error}
        </Notice>
      ) : null}

      {!data ? (
        <SkeletonRows rows={3} label={t('backups.title')} />
      ) : (
        <>
          <div className="grid--cards">
            <Panel>
              <div className="panel-head">
                <h2 className="display-sm">{t('backups.local')}</h2>
              </div>
              {data.local ? (
                <>
                  <Row
                    label={t('backups.file')}
                    identifier={data.local.name}
                    meta={t('backups.when') + ': ' + relative(data.local.mtime, locale)}
                    trailing={bytes(data.local.bytes, locale)}
                  />
                </>
              ) : (
                <p className="body muted">{t('backups.empty')}</p>
              )}
            </Panel>

            <Panel>
              <div className="panel-head">
                <h2 className="display-sm">{t('backups.remote')}</h2>
              </div>
              {data.remote?.lastOkAt ? (
                <Row
                  label={t('backups.lastRun')}
                  identifier={data.remote.lastOkFile ?? '—'}
                  meta={
                    <>
                      {relative(data.remote.lastOkAt, locale)}
                      {' · '}
                      {data.remote.verifiedError ? (
                        <Chip tone="bad">{t('backups.verifiedFailed')}</Chip>
                      ) : data.remote.verifiedAt ? (
                        <Chip tone="ok">{t('backups.verified')}</Chip>
                      ) : (
                        <Chip tone="notice">{t('backups.notVerified')}</Chip>
                      )}
                    </>
                  }
                />
              ) : (
                <p className="body muted">{t('backups.never')}</p>
              )}
            </Panel>
          </div>

          <Panel>
            <div className="panel-head">
              <h2 className="display-sm">{t('backups.files')}</h2>
            </div>
            {data.files.length === 0 ? (
              <p className="body muted">{t('backups.empty')}</p>
            ) : (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('backups.file')}</th>
                      <th>{t('backups.size')}</th>
                      <th>{t('backups.when')}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.files.map((file) => (
                      <tr key={file.name}>
                        <td className="mono">{file.name}</td>
                        <td>{bytes(file.bytes, locale)}</td>
                        <td>{relative(file.mtime, locale)}</td>
                        <td>
                          {/* An anchor, not a Button: the download has to be a real
                              navigation so the browser streams it to disk. */}
                          <a
                            className="btn btn--secondary btn--sm"
                            href={'/api/backups/' + file.name + '/download'}
                          >
                            {t('backups.download')}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
