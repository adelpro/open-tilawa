import type { ReactElement } from 'react';
import { useI18n, type MessageKey } from '../lib/i18n';
import { Panel } from '../components/Panel';
import { CopyLine } from '../components/CopyLine';

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
 * Per-section help plus the node tutorials.
 *
 * Every sentence lives in the catalogue (so the Arabic page is a translation of
 * this one rather than a second source of truth); commands stay literal — a
 * shell command is not prose, and a translated one would not run.
 */
export function Help(): ReactElement {
  const { t } = useI18n();
  const copy = t('help.copy');

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

      <h2 className="group-title">{t('help.tutorials.title')}</h2>
      <p className="body muted">{t('help.tutorials.lede')}</p>

      <Panel>
        <details open>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{t('help.seeder.title')}</summary>
          <div className="stack" style={{ marginTop: 'var(--space-3)' }}>
            <ol className="stack">
              <li className="body">{t('help.seeder.step1')}</li>
              <li className="body">{t('help.seeder.step2')}</li>
            </ol>
            <CopyLine
              value={'ADMIN_PORT=8085\nADMIN_USER=admin\nADMIN_PASS=<strong password>'}
              label={copy}
            />
            <ol className="stack" start={3}>
              <li className="body">{t('help.seeder.step3')}</li>
            </ol>
            <CopyLine value={'docker compose up -d --build seeder'} label={copy} />
            <ol className="stack" start={4}>
              <li className="body">{t('help.seeder.step4')}</li>
              <li className="body">{t('help.seeder.step5')}</li>
            </ol>
            <CopyLine value={'curl -s http://<host>:8085/health'} label={copy} />
            <ol className="stack" start={6}>
              <li className="body">{t('help.seeder.step6')}</li>
            </ol>
            <CopyLine
              value={'docker cp release.torrent node:/data/torrents/'}
              label={copy}
            />
            <ol className="stack" start={7}>
              <li className="body">{t('help.seeder.step7')}</li>
            </ol>
            <p className="body muted">{t('help.seeder.step8')}</p>
          </div>
        </details>
      </Panel>

      <Panel>
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{t('help.turn.title')}</summary>
          <div className="stack" style={{ marginTop: 'var(--space-3)' }}>
            <ol className="stack">
              <li className="body">{t('help.turn.step1')}</li>
            </ol>
            <CopyLine
              value={
                'TURN_REALM=turn.example.com\nTURN_USERNAME=opentilawa\nTURN_PASSWORD=<strong password>\nTURN_EXTERNAL_IP=<public ip>'
              }
              label={copy}
            />
            <ol className="stack" start={2}>
              <li className="body">{t('help.turn.step2')}</li>
            </ol>
            <CopyLine value={'docker compose -f docker-compose.turn.yml up -d'} label={copy} />
            <ol className="stack" start={3}>
              <li className="body">{t('help.turn.step3')}</li>
            </ol>
            <CopyLine
              value={
                'ufw allow 3478/udp && ufw allow 3478/tcp && ufw allow 5349/tcp && ufw allow 49160:49200/udp'
              }
              label={copy}
            />
            <p className="body muted">{t('help.turn.step4')}</p>
          </div>
        </details>
      </Panel>

      <Panel>
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
            {t('help.publish.title')}
          </summary>
          <div className="stack" style={{ marginTop: 'var(--space-3)' }}>
            <ol className="stack">
              <li className="body">{t('help.publish.step1')}</li>
              <li className="body">{t('help.publish.step2')}</li>
              <li className="body">{t('help.publish.step3')}</li>
              <li className="body">{t('help.publish.step4')}</li>
            </ol>
            <CopyLine
              value={'docker cp release.torrent open-tilawa-seeder:/data/torrents/'}
              label={copy}
            />
          </div>
        </details>
      </Panel>
    </div>
  );
}
