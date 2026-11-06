import { useState } from 'react';
import type { ReactElement } from 'react';
import { api } from '../lib/api';
import { relative } from '../lib/format';
import { useI18n } from '../lib/i18n';
import type { SiteStatus } from '../lib/site-status';
import { Button } from './Button';
import { Notice } from './Chip';
import { ConfirmModal } from './ConfirmModal';
import { Icon, Spinner } from './icons';
import { Modal } from './Modal';

/**
 * The public site is a prerendered build. Publishing a reciter updates the app's
 * roster immediately, but that reciter's page and sitemap row do not exist until
 * the next build — so the console says so, with the exact difference, rather than
 * leaving the operator to remember.
 *
 * The notice is computed, not dismissed: unpublish the reciters and the two sides
 * match again, so it disappears on its own. Nothing is stored on this screen.
 */
export function SiteRebuildNotice({
  status,
  onRefresh,
}: {
  status: SiteStatus | null;
  onRefresh: () => void;
}): ReactElement | null {
  const { t, locale } = useI18n();
  const [confirm, setConfirm] = useState(false);
  const [info, setInfo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!status || status.state === 'in-sync') return null;

  const added = status.added.length;
  const removed = status.removed.length;
  const renamed = status.renamed.length;
  const names = [...status.added, ...status.removed]
    .slice(0, 3)
    .map((release) => release.name)
    .join(locale === 'ar' ? '، ' : ', ');

  const blockedHint =
    status.blockedBy === 'disabled'
      ? t('reciters.site.disabled')
      : status.blockedBy === 'dirty-tree'
        ? t('reciters.site.dirty', { files: status.dirtyFiles.join(', ') })
        : status.blockedBy === 'unsupported'
          ? (status.treeError ?? t('reciters.site.unsupported'))
          : null;

  const tone = status.state === 'failed' ? 'bad' : 'warn';
  const title =
    status.state === 'failed'
      ? t('reciters.site.failed')
      : status.state === 'unknown'
        ? t('reciters.site.unknown')
        : t('reciters.site.title');

  async function start(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await api('/reciters/site/rebuild', { method: 'POST' });
      setConfirm(false);
      onRefresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('reciters.site.startFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Notice tone={tone}>
        <div className="stack stack--tight">
          <div className="cluster site-sync__head">
            <Icon name="info" size={16} />
            <strong>{title}</strong>
            <button
              type="button"
              className="site-sync__info"
              aria-label={t('reciters.site.infoTitle')}
              onClick={() => setInfo(true)}
            >
              <Icon name="info" size={14} />
            </button>
          </div>

          {status.state === 'building' ? (
            <p className="body site-sync__line">
              <Spinner />
              {t('reciters.site.building', {
                time: status.lastBuild ? relative(status.lastBuild.startedAt, locale) : '',
              })}
            </p>
          ) : (
            <>
              {added > 0 ? (
                <span>{t('reciters.site.added', { count: String(added) })}</span>
              ) : null}
              {removed > 0 ? (
                <span>{t('reciters.site.removed', { count: String(removed) })}</span>
              ) : null}
              {renamed > 0 ? (
                <span>{t('reciters.site.renamed', { count: String(renamed) })}</span>
              ) : null}
              {names ? (
                <p className="row__meta">
                  {t('reciters.site.names', { names })}
                </p>
              ) : null}
              {status.state === 'unknown' && status.manifestError ? (
                <p className="row__meta">{status.manifestError}</p>
              ) : null}
              {status.state === 'failed' && status.lastBuild?.error ? (
                <pre className="row__meta" style={{ whiteSpace: 'pre-wrap', direction: 'ltr' }}>
                  {status.lastBuild.error}
                </pre>
              ) : null}
              {error ? <p className="row__meta">{error}</p> : null}
              {blockedHint ? <p className="row__meta">{blockedHint}</p> : null}
            </>
          )}

          {status.state !== 'building' ? (
            <div className="cluster">
              <Button
                variant="warning"
                small
                icon={<Icon name="refresh" />}
                disabled={!status.canRebuild || busy}
                onClick={() => setConfirm(true)}
              >
                {t('reciters.site.build')}
              </Button>
              {status.deployedCount !== null && status.deployedAt ? (
                <span className="row__meta">
                  {t('reciters.site.deployed', {
                    count: String(status.deployedCount),
                    time: relative(status.deployedAt, locale),
                  })}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </Notice>

      {confirm ? (
        <ConfirmModal
          title={t('reciters.site.confirmTitle')}
          body={t('reciters.site.confirmBody')}
          hint={t('reciters.site.confirmHint')}
          confirmLabel={t('reciters.site.build')}
          busy={busy}
          onConfirm={() => void start()}
          onClose={() => setConfirm(false)}
        >
          {error ? <p className="row__meta">{error}</p> : null}
        </ConfirmModal>
      ) : null}

      {info ? (
        <Modal title={t('reciters.site.infoTitle')} onClose={() => setInfo(false)}>
          <div className="stack">
            <p className="body">{t('reciters.site.infoBody')}</p>
            <p className="fine-print">{t('reciters.site.infoList')}</p>
            <div className="cluster cluster--end">
              <Button onClick={() => setInfo(false)}>{t('common.close')}</Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
