import type { ReactElement } from 'react';
import { useI18n, type MessageKey } from '../lib/i18n';
import { Panel } from '../components/Panel';

const sections: { titleKey: MessageKey; bodyKey: MessageKey }[] = [
  { titleKey: 'help.seeders.title', bodyKey: 'help.seeders.body' },
  { titleKey: 'help.turns.title', bodyKey: 'help.turns.body' },
  { titleKey: 'help.torrents.title', bodyKey: 'help.torrents.body' },
  { titleKey: 'help.reciters.title', bodyKey: 'help.reciters.body' },
  { titleKey: 'help.account.title', bodyKey: 'help.account.body' },
  { titleKey: 'help.admin.title', bodyKey: 'help.admin.body' },
  { titleKey: 'help.setup.title', bodyKey: 'help.setup.body' },
];

/**
 * Per-section help. Every sentence lives in the catalogue, so the Arabic page is
 * a translation of this one rather than a second source of truth.
 */
export function Help(): ReactElement {
  const { t } = useI18n();
  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <h1 className="display-lg">{t('help.title')}</h1>
          <p className="body muted">{t('help.lede')}</p>
        </div>
      </header>
      {sections.map((s) => (
        <Panel key={s.titleKey}>
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{t(s.titleKey)}</summary>
            <p className="body" style={{ marginTop: 'var(--space-3)' }}>
              {t(s.bodyKey)}
            </p>
          </details>
        </Panel>
      ))}
    </div>
  );
}
