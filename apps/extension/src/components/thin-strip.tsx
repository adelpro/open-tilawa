/**
 * The swarm's one ask: releases nobody is serving right now.
 *
 * Not a "new" list and not dismissed — the row is a measurement, and the next
 * fetch brings it back while it still holds. Adding one is the same manual choice
 * as ticking a row, so nothing here is a subscription and nothing downloads
 * itself. Six at a time: a strip that lists the whole catalogue is a page, not a
 * suggestion.
 */

import { formatBytes } from '@/lib/badge';
import type { Reciter } from '@/lib/catalogue';
import { PlusIcon } from '@/components/icons';

export const THIN_LIMIT = 6;

export function ThinStrip({
  rows,
  labels,
  onAdd,
}: {
  rows: Reciter[];
  labels: { title: string; hint: string; add: string; unknown: string };
  onAdd: (infohash: string) => void;
}) {
  if (rows.length === 0) return null;

  return (
    <section className="fresh" aria-label={labels.title}>
      <div className="fresh-head">
        <h2>{labels.title}</h2>
      </div>
      <p className="meta">{labels.hint}</p>
      <ul>
        {rows.map((reciter) => (
          <li key={reciter.infohash}>
            <span style={{ flex: 1, minInlineSize: 0 }}>
              <span className="name">{reciter.nameAr || reciter.name}</span>
              <span className="meta">
                {reciter.riwaya} · {reciter.sizeBytes ? formatBytes(reciter.sizeBytes) : labels.unknown}
              </span>
            </span>
            <button type="button" className="action" onClick={() => onAdd(reciter.infohash)}>
              <PlusIcon /> {labels.add}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
