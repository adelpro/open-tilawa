import type { ReactElement, ReactNode } from 'react';

/** A panel is the primary container: premium shadow, 18px radius. */
export function Panel({
  children,
  tone = 'plain',
  className = '',
}: {
  children: ReactNode;
  tone?: 'plain' | 'parchment' | 'cream';
  className?: string;
}): ReactElement {
  const modifier = tone === 'plain' ? '' : `panel--${tone}`;
  return <section className={`panel ${modifier} ${className}`.trim()}>{children}</section>;
}

/** The three-line row: label, mono identifier, fine-print metadata. */
export function Row({
  label,
  identifier,
  meta,
  onClick,
  selected,
  trailing,
}: {
  label: ReactNode;
  identifier?: ReactNode;
  meta?: ReactNode;
  onClick?: () => void;
  selected?: boolean;
  trailing?: ReactNode;
}): ReactElement {
  const content = (
    <>
      <span className="grow stack stack--tight" style={{ gap: 2 }}>
        <span className="row__label">{label}</span>
        {identifier ? <span className="row__id truncate">{identifier}</span> : null}
        {meta ? <span className="row__meta">{meta}</span> : null}
      </span>
      {trailing}
    </>
  );

  if (!onClick) return <div className="row">{content}</div>;

  return (
    <button
      type="button"
      className="row"
      onClick={onClick}
      aria-selected={selected ? true : undefined}
    >
      {content}
    </button>
  );
}
