import type { ReactElement, ReactNode } from 'react';
import { linkProps } from '../lib/router';
import { Chip } from './Chip';
import type { ChipTone } from './Chip';

export interface NodeMetric {
  label: string;
  value: ReactNode;
  /** A second line under the value: a qualifier, a chip, "no limit". */
  hint?: ReactNode;
  /**
   * 0–1, for the one metric that is a tank: used over quota. The meter is a reading,
   * not a control, so it is hidden from assistive tech — the value beside it is the fact.
   */
  ratio?: number;
}

/**
 * One machine you own: a seeder, a TURN server, the relay.
 *
 * The same card at both breakpoints, because a table that re-flows into cards on mobile
 * is two designs to keep in step — and it was two: the mobile version stacked unlabelled
 * cells into a box. The name is the only link; the card itself is not a click target, so
 * the three buttons inside it stay buttons. Pinned state is a wash plus a badge, never a
 * bar on a physical side, which is where the old marker ended up in an RTL page.
 */
export function NodeCard({
  title,
  href,
  url,
  statusTone,
  statusLabel,
  badges,
  note,
  pinned = false,
  metrics,
  actions,
}: {
  title: string;
  href?: string;
  url?: string;
  statusTone: ChipTone;
  statusLabel: string;
  badges?: ReactNode;
  note?: ReactNode;
  pinned?: boolean;
  metrics: NodeMetric[];
  actions?: ReactNode;
}): ReactElement {
  return (
    <article className={pinned ? 'node-card node-card--pinned' : 'node-card'}>
      <div className="node-card__identity">
        <span className="node-card__title-line">
          {href ? (
            <a className="node-card__name" {...linkProps(href)}>
              {title}
            </a>
          ) : (
            <span className="node-card__name">{title}</span>
          )}
          <Chip tone={statusTone}>{statusLabel}</Chip>
          {badges}
        </span>
        {url ? (
          <span className="node-card__url" title={url}>
            <bdi>{url}</bdi>
          </span>
        ) : null}
        {note ? <span className="node-card__note">{note}</span> : null}
      </div>

      <dl className="node-card__metrics">
        {metrics.map((metric) => (
          <div className="node-card__metric" key={metric.label}>
            <dt>{metric.label}</dt>
            <dd>
              {metric.value}
              {metric.hint ? <span className="node-card__hint">{metric.hint}</span> : null}
              {metric.ratio === undefined ? null : <Meter ratio={metric.ratio} />}
            </dd>
          </div>
        ))}
      </dl>

      {actions ? <div className="node-card__actions">{actions}</div> : null}
    </article>
  );
}

/** The tank: used of quota, with the 90 % line where the push stops. */
function Meter({ ratio }: { ratio: number }): ReactElement {
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <span className="meter" data-full={clamped >= 0.9 ? 'true' : undefined} aria-hidden="true">
      <span className="meter__fill" style={{ inlineSize: `${clamped * 100}%` }} />
    </span>
  );
}
