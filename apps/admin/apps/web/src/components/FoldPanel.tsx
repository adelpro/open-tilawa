import { useId, type ReactElement, type ReactNode } from 'react';

import { Icon } from './icons';
import { Panel } from './Panel';

/**
 * A panel whose heading is also its toggle.
 *
 * The heading stays an `h2` so the page keeps its outline; the button inside it
 * carries `aria-expanded` and `aria-controls`, and the body is `hidden` when
 * folded. Nothing animates the height: a table that grows open is slower than a
 * table that is simply there.
 */
export function FoldPanel({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}): ReactElement {
  const id = useId();
  return (
    <Panel>
      <h2 className="panel__title">
        <button
          type="button"
          className="panel__toggle"
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
        >
          <span>{title}</span>
          <Icon name="down" size={16} className="panel__chevron" />
        </button>
      </h2>
      <div id={id} className="panel__body" hidden={!open}>
        {children}
      </div>
    </Panel>
  );
}
