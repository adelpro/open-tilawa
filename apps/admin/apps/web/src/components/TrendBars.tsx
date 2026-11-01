import type { ReactElement } from 'react';

import { useI18n } from '../lib/i18n';
import { trendLayout, type TrendRow } from '../lib/usage-chart';

const WIDTH = 640;
const HEIGHT = 150;
const LABEL_HEIGHT = 22;

/**
 * Devices and listeners per day, as grouped bars.
 *
 * Decoration over the table that follows it, so the SVG is hidden from assistive
 * tech; the numbers a reader needs are the same rows as text. Listeners share the
 * accent at a lower opacity rather than a second hue: the page has one graphic
 * colour, and a second colour would read as a different kind of fact.
 */
export function TrendBars({ rows }: { rows: readonly TrendRow[] }): ReactElement {
  const { t } = useI18n();
  const { bars, labels, baseline } = trendLayout(rows, {
    width: WIDTH,
    height: HEIGHT,
    labelHeight: LABEL_HEIGHT,
  });

  return (
    <div className="usage-trend">
      <div className="usage-trend__legend" aria-hidden="true">
        <span>
          <span className="usage-trend__swatch usage-trend__swatch--devices" />
          {t('usage.devicesCount')}
        </span>
        <span>
          <span className="usage-trend__swatch usage-trend__swatch--listeners" />
          {t('usage.listenersCount')}
        </span>
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true" focusable="false">
        <line
          className="usage-trend__baseline"
          x1="0"
          y1={baseline}
          x2={WIDTH}
          y2={baseline}
        />
        {bars.map((bar) => (
          <rect
            key={bar.key}
            className={`usage-trend__bar usage-trend__bar--${bar.series}`}
            x={bar.x}
            y={bar.y}
            width={bar.width}
            height={bar.height}
            rx="2"
          />
        ))}
        {labels.map((label) => (
          <text
            key={label.key}
            className="usage-trend__label"
            x={label.x}
            y={baseline + 15}
            textAnchor="middle"
          >
            {label.text}
          </text>
        ))}
      </svg>
    </div>
  );
}
