import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../lib/api';
import { duration as ms } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { Chip, Notice } from './Chip';
import { Panel } from './Panel';

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

interface StatsDay {
  date: string;
  total: number;
  ok: number;
  fail: number;
}
interface StatsTool {
  tool: string;
  count: number;
  avgMs: number | null;
  maxMs: number | null;
  failCount: number;
}
interface Stats {
  range: number;
  days: StatsDay[];
  tools: StatsTool[];
  latency: { avgMs: number | null; maxMs: number | null };
  errorRate: number;
  total: number;
  activeKeys: number;
}

/**
 * Analytics (D1 decided: Recharts — SVG output matches the app's rendering
 * estate; D2: a whitelist range, 7/30/90, rendered as segmented pills; the
 * default app page never sends an arbitrary date string).
 */
const TOOL_DESCRIPTIONS: Record<string, string> = {
  get_profile: 'Reads the active voice profile (manifest, house style, preferences, voice card).',
  manage_profile: 'Lists, creates, renames or sets the default profile.',
  learn_preference: 'Records a durable preference for a profile (requires consent).',
  run_gate: 'Runs the profile toolchain (avoid-ai-writing, remove-ai-marks) over a draft.',
  doctor: 'Deployment health: gate versions, interpreter, store integrity.',
  render_profile: 'Returns the voice card or full profile as files with hashes.',
  generate_profile: 'Builds a profile from writing samples (preview, then confirm).',
};

function toolDescription(name: string): string {
  return TOOL_DESCRIPTIONS[name] ?? 'Uslub MCP tool.';
}

export function StatsPanel(): ReactElement {
  const { t, locale } = useI18n();
  const [range, setRange] = useState<Range>(30);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Range | null>(null);

  const effectiveRange = loaded && loaded !== range ? loaded : range;

  useEffect(() => {
    void (async () => {
      try {
        const s = await api<Stats>(`/usage/stats?range=${range}`);
        setStats(s);
        setLoaded(range);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : t('usage.loadFailed'));
      }
    })();
  }, [range, t]);

  const chartData = useMemo(
    () =>
      (stats?.days ?? []).map((d) => ({
        ...d,
        // axis labels: keep them short and locale-neutral
        label: d.date.slice(5),
      })),
    [stats],
  );

  const pct = stats ? Math.round(stats.errorRate * 1000) / 10 : 0;

  return (
    <Panel>
      <div className="spread" style={{ marginBottom: 'var(--space-4)' }}>
        <h2 className="display-sm" style={{ margin: 0 }}>
          {t('usage.stats.title')}
        </h2>
        <div className="cluster" role="group" aria-label={t('usage.stats.range')}>
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              className={`chip-range${r === range ? ' chip-range--on' : ''}`}
              aria-pressed={r === range}
              onClick={() => setRange(r)}
            >
              {r === 30 ? t('usage.stats.month') : t('usage.stats.days', { count: r })}
            </button>
          ))}
        </div>
      </div>

      {error ? <Notice tone="bad">{error}</Notice> : null}

      {stats ? (
        <div className="stack">
          <div className="spread" style={{ flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <Chip tone="ok">{t('usage.stats.requests', { count: stats.total })}</Chip>
            <Chip tone={stats.activeKeys > 0 ? 'ok' : 'notice'}>
              {t('usage.stats.keys', { count: stats.activeKeys })}
            </Chip>
            <Chip tone="ok">
              {t('usage.stats.latency', { avg: ms(stats.latency.avgMs ?? 0, locale) })}
            </Chip>
            <Chip tone={pct > 5 ? 'bad' : pct > 0 ? 'notice' : 'ok'}>
              {t('usage.stats.errors', { pct })}
            </Chip>
          </div>

          {/* the chart keeps the canvas register: hairline grid, teal area, no legend */}
          <div className="stats-chart" style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="statsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#086288" stopOpacity={0.24} />
                    <stop offset="100%" stopColor="#086288" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#00000014" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'rgba(29,29,31,0.6)' }}
                  tickLine={false}
                  axisLine={false}
                  interval={Math.max(0, Math.floor((effectiveRange || 30) / 6) - 1)}
                  reversed={locale === 'ar'}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: 'rgba(29,29,31,0.6)' }}
                  tickLine={false}
                  axisLine={false}
                  orientation={locale === 'ar' ? 'right' : 'left'}
                />
                <Tooltip
                  cursor={{ stroke: 'rgba(8,98,136,0.35)' }}
                  formatter={(value) =>
                    [String(value), t('usage.stats.requestsN')] as [string, string]
                  }
                  labelFormatter={(label) => t('usage.stats.day', { day: String(label) })}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#086288"
                  strokeWidth={2}
                  fill="url(#statsFill)"
                  isAnimationActive
                  animationDuration={400}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {stats.tools.length > 0 ? (
            <div className="table-scroll">
              <table className="table" aria-label={t('usage.stats.perTool')}>
                <thead>
                  <tr>
                    <th>{t('usage.tool')}</th>
                    <th>{t('usage.status')}</th>
                    <th className="num">{t('usage.duration')}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.tools.map((tool) => (
                    <tr key={tool.tool}>
                      <td>
                        <span className="cluster" style={{ gap: 'var(--space-2)' }}>
                          <code>{tool.tool}</code>
                          <button
                            type="button"
                            title={toolDescription(tool.tool)}
                            aria-label={`Info about ${tool.tool}`}
                            style={{
                              border: 0,
                              background: 'transparent',
                              cursor: 'help',
                              padding: 0,
                              color: 'var(--ink-secondary, #666)',
                            }}
                          >
                            ⓘ
                          </button>
                        </span>
                      </td>
                      <td className="num">
                        {tool.failCount > 0 ? (
                          <Chip tone="bad">
                            {t('usage.stats.failCount', { n: tool.failCount, count: tool.count })}
                          </Chip>
                        ) : (
                          <Chip tone="ok">{t('usage.stats.allOk', { count: tool.count })}</Chip>
                        )}
                      </td>
                      <td className="num">{ms(tool.avgMs ?? 0, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">{t('usage.stats.noTools')}</div>
          )}
        </div>
      ) : null}
    </Panel>
  );
}
