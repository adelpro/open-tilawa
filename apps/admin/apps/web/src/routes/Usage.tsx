import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { api } from '../lib/api';
import { duration, relative } from '../lib/format';
import { useI18n } from '../lib/i18n';
import type { ApiKey, AuditEntry } from '../lib/types';
import { Panel } from '../components/Panel';
import { Chip, Notice } from '../components/Chip';
import { CopyLine } from '../components/CopyLine';
import { StatsPanel } from '../components/StatsPanel';
import { Tabs } from '../components/Tabs';

interface UsageSummary {
  audit: AuditEntry[];
  total: number;
  limits: Record<string, string>;
}

export function Usage(): ReactElement {
  const { t, locale } = useI18n();
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'activity' | 'stats' | 'setup'>('activity');
  const [keyFilter, setKeyFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  useEffect(() => {
    void (async () => {
      try {
        setSummary(await api<UsageSummary>('/usage'));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : t('usage.loadFailed'));
      }
      try {
        setKeys(await api<ApiKey[]>('/api-keys'));
      } catch {
        setKeys([]);
      }
    })();
  }, [t]);

  const keyName = (id: number | null): string => {
    if (id === null) return '—';
    const k = keys?.find((k) => k.id === id);
    return k ? `${k.label} (${k.prefix})` : `key #${id}`;
  };

  const filteredAudit = useMemo(() => {
    const rows = summary?.audit ?? [];
    return rows.filter((e) => {
      if (keyFilter !== 'all' && String(e.key_id) !== keyFilter) return false;
      if (fromDate) {
        const d = new Date(e.created_at).toISOString().slice(0, 10);
        if (d < fromDate) return false;
      }
      if (toDate) {
        const d = new Date(e.created_at).toISOString().slice(0, 10);
        if (d > toDate) return false;
      }
      return true;
    });
  }, [summary, keyFilter, fromDate, toDate]);

  return (
    <div className="stack">
      <div>
        <h1 className="display-lg">{t('usage.title')}</h1>
        <p className="body muted">{t('usage.lede')}</p>
      </div>

      {error ? <Notice tone="bad">{error}</Notice> : null}

      <Tabs
        items={[
          { id: 'activity', label: 'Activity' },
          { id: 'stats', label: 'Stats' },
          { id: 'setup', label: 'Setup' },
        ]}
        active={tab}
        onChange={setTab}
        label="Usage sections"
      />

      {tab === 'activity' ? (
        <Panel>
          <div className="spread" style={{ marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <h2 className="display-sm" style={{ margin: 0 }}>{t('usage.recent')}</h2>
            <span className="fine-print">
              {summary ? t('usage.total', { count: filteredAudit.length }) : ''}
            </span>
          </div>
          <div className="toolbar" style={{ marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <label className="field" style={{ minWidth: '10rem' }}>
              <span className="label">Key</span>
              <select className="input" value={keyFilter} onChange={(e) => setKeyFilter(e.target.value)}>
                <option value="all">All keys</option>
                {(keys ?? []).map((k) => (
                  <option key={k.id} value={k.id}>{k.label} ({k.prefix})</option>
                ))}
              </select>
            </label>
            <label className="field" style={{ minWidth: '9rem' }}>
              <span className="label">From</span>
              <input type="date" className="input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </label>
            <label className="field" style={{ minWidth: '9rem' }}>
              <span className="label">To</span>
              <input type="date" className="input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </label>
          </div>
          {summary && filteredAudit.length === 0 ? (
            <div className="empty">{t('usage.empty')}</div>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('usage.action')}</th>
                    <th>Key</th>
                    <th>{t('usage.target')}</th>
                    <th>{t('usage.status')}</th>
                    <th className="num">{t('usage.duration')}</th>
                    <th>{t('usage.when')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAudit.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <code>{entry.action}</code>
                      </td>
                      <td className="muted">{keyName(entry.key_id)}</td>
                      <td className="truncate">{entry.target ?? '—'}</td>
                      <td>
                        <Chip
                          tone={
                            entry.status === 'error'
                              ? 'bad'
                              : entry.status === 'denied'
                                ? 'notice'
                                : 'ok'
                          }
                        >
                          {entry.status ?? 'ok'}
                        </Chip>
                      </td>
                      <td className="num">{entry.ms === null ? '—' : duration(entry.ms, locale)}</td>
                      <td className="muted">{relative(entry.created_at, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ) : null}

      {tab === 'stats' ? <StatsPanel /> : null}

      {tab === 'setup' ? (
        <>
          <Panel>
            <h2 className="display-sm" style={{ marginBottom: 'var(--space-4)' }}>
              {t('usage.point')}
            </h2>
            <div className="stack">
              <CopyLine value="hermes config set mcp.servers.uslub.url https://uslub.adelpro.us.kg/mcp" />
              <CopyLine value="claude mcp add --transport http uslub https://uslub.adelpro.us.kg/mcp --header 'Authorization: Bearer YOUR_KEY_HERE'" />
              <CopyLine value="codex mcp add uslub --url https://uslub.adelpro.us.kg/mcp --bearer YOUR_KEY_HERE" />
              <CopyLine
                value={
                  '{\n  "mcpServers": {\n    "uslub": {\n      "url": "https://uslub.adelpro.us.kg/mcp",\n      "headers": { "Authorization": "Bearer YOUR_KEY_HERE" }\n    }\n  }\n}'
                }
                label={t('usage.copyCursor')}
              />
            </div>
          </Panel>

          <Panel tone="parchment">
            <h2 className="display-sm" style={{ marginBottom: 'var(--space-3)' }}>
              {t('usage.limits')}
            </h2>
            <ul className="body" style={{ margin: 0, paddingInlineStart: '1.2em' }}>
              {summary
                ? Object.entries(summary.limits).map(([label, value]) => (
                    <li key={label}>
                      <span className="body-strong">{label}</span>: {value}
                    </li>
                  ))
                : null}
            </ul>
          </Panel>
        </>
      ) : null}
    </div>
  );
}
