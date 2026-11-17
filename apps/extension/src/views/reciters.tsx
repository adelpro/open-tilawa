/**
 * The reciters view as two lists, not one.
 *
 * **My reciters** is what this device will hold — the reciters that used to be
 * ticked rows now live here, with a count and their total size. **The follow
 * list** is what the site says the person listens to; it rotates on its own and
 * shows its source on every row, so an automatic addition can never pose as a
 * choice. **The rest** is everyone else, and adding one moves it up. Each list
 * has its own accordion and remembers whether it was open, because a person who
 * collapsed the catalogue to look at their own three reciters should not find it
 * expanded on the next visit.
 *
 * A filter narrows "the rest" only: hiding the reciters you already hold behind a
 * riwaya filter would make the top list look empty for no reason.
 */

import { formatBytes } from '@/lib/badge';
import { reciterUrl, type HeldReciter, type Reciter } from '@/lib/catalogue';
import type { Copy } from '@/lib/i18n';
import type { Sort } from '@/lib/sort';
import { FreshStrip } from '@/components/fresh-strip';
import { THIN_LIMIT, ThinStrip } from '@/components/thin-strip';
import { RiwayaFilter } from '@/components/riwaya-filter';
import { SortBar } from '@/components/sort-bar';
import { PlusIcon, TrashIcon } from '@/components/icons';

/**
 * The name as a door out.
 *
 * A release with a slug opens its own page on tilawah.cc in a new tab; a slug-
 * less release — unpublished, or the catalogue has not named it yet — is a plain
 * name, because a link that 404s would be a worse neighbour than no link. The
 * tags beside the name stay outside the anchor: clicking «متابعة» is not a
 * journey.
 */
function ReciterName({ reciter }: { reciter: Pick<Reciter, 'slug' | 'name' | 'nameAr'> }) {
  const url = reciterUrl(reciter.slug);
  const label = reciter.nameAr || reciter.name;
  return url ? (
    <a className="name-link" href={url} target="_blank" rel="noreferrer">
      {label}
    </a>
  ) : (
    <>{label}</>
  );
}

export function RecitersView({
  copy,
  loading,
  failed,
  rows,
  ordered,
  fresh,
  unpublished,
  mine,
  follow,
  mineOpen,
  rosterOpen,
  sort,
  riwayat,
  onMineOpen,
  onRosterOpen,
  onRetry,
  onAdd,
  onDismissFresh,
  onRemove,
  onRemoveFollow,
  onSort,
  onRiwayat,
  onRemoveUnpublished,
}: {
  copy: Copy;
  loading: boolean;
  failed: boolean;
  rows: Reciter[];
  ordered: Reciter[];
  fresh: Reciter[];
  unpublished: HeldReciter[];
  /** Selected rows, in roster order. */
  mine: Reciter[];
  /** Rows the site's play notices added; they rotate and show their source. */
  follow: HeldReciter[];
  mineOpen: boolean;
  rosterOpen: boolean;
  sort: Sort;
  riwayat: string[];
  onMineOpen: (open: boolean) => void;
  onRosterOpen: (open: boolean) => void;
  onRetry: () => void;
  onAdd: (infohash: string) => void;
  onDismissFresh: () => void;
  onRemove: (infohash: string) => void;
  onRemoveFollow: (infohash: string) => void;
  onSort: (next: Sort) => void;
  onRiwayat: (next: string[]) => void;
  onRemoveUnpublished: (infohash: string) => void;
}) {
  const mineBytes = mine.reduce((sum, reciter) => sum + (reciter.sizeBytes ?? 0), 0);
  // The roster offers only what nobody holds: a follow row is already on the
  // device, and an «أضف» button on it would promise a download that exists.
  const available = ordered.filter(
    (reciter) =>
      !mine.some((held) => held.infohash === reciter.infohash) &&
      !follow.some((held) => held.infohash === reciter.infohash),
  );

  // The swarm's ask, excluding what this device already holds: suggesting a copy
  // of something on the disk is a suggestion to do nothing.
  const thin = available.filter((reciter) => reciter.swarm?.health === 'thin');

  return (
    <section id="reciters" className="screen" aria-labelledby="reciters-title">
      <FreshStrip
        rows={fresh}
        labels={{ title: copy.freshTitle, add: copy.add, unknown: copy.unknownSize, dismiss: copy.dismiss }}
        onAdd={onAdd}
        onDismiss={onDismissFresh}
      />

      <ThinStrip
        rows={thin.slice(0, THIN_LIMIT)}
        labels={{
          title: copy.thinTitle.replace('{n}', String(thin.length)),
          hint: copy.thinHint,
          add: copy.add,
          unknown: copy.unknownSize,
        }}
        onAdd={onAdd}
      />

      <details
        className="group"
        open={mineOpen}
        // `toggle` from a nested <details> (the riwaya filter) must not be read as
        // this group closing — that is what collapsed the roster on an outside click.
        onToggle={(event) => {
          if (event.target !== event.currentTarget) return;
          onMineOpen((event.target as HTMLDetailsElement).open);
        }}
      >
        <summary>
          <span className="name">{copy.mineTitle}</span>
          <span className="meta">
            {mine.length > 0
              ? `${mine.length} · ${formatBytes(mineBytes)}`
              : copy.mineEmpty}
          </span>
        </summary>

        {mine.length === 0 ? (
          <p className="meta">{copy.mineLede}</p>
        ) : (
          <ul className="roster">
            {mine.map((reciter) => (
              <li key={reciter.infohash} data-infohash={reciter.infohash}>
                <span className="row">
                  <span>
                    <span className="name">
                      <ReciterName reciter={reciter} />
                      {reciter.complete ? null : <span className="tag">{copy.partial}</span>}
                    </span>
                    <span className="meta">
                      {reciter.riwaya} ·{' '}
                      {reciter.sizeBytes ? formatBytes(reciter.sizeBytes) : copy.unknownSize}
                    </span>
                  </span>
                </span>
                <button type="button" className="action" onClick={() => onRemove(reciter.infohash)}>
                  <TrashIcon /> {copy.remove}
                </button>
              </li>
            ))}
          </ul>
        )}
      </details>

      {follow.length > 0 ? (
        <details className="group" open>
          <summary>
            <span className="name">{copy.followTitle}</span>
            <span className="meta">{follow.length}</span>
          </summary>
          <p className="meta">{copy.followHint}</p>
          <ul className="roster">
            {follow.map((reciter) => (
              <li key={reciter.infohash} data-infohash={reciter.infohash}>
                <span className="row">
                  <span>
                    <span className="name">
                      <ReciterName reciter={reciter} />
                      <span className="tag">{copy.followTag}</span>
                      {reciter.complete ? null : <span className="tag">{copy.partial}</span>}
                    </span>
                    <span className="meta">
                      {reciter.riwaya} ·{' '}
                      {reciter.sizeBytes ? formatBytes(reciter.sizeBytes) : copy.unknownSize}
                    </span>
                  </span>
                </span>
                <button type="button" className="action" onClick={() => onRemoveFollow(reciter.infohash)}>
                  <TrashIcon /> {copy.remove}
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <details
        className="group"
        open={rosterOpen}
        onToggle={(event) => {
          if (event.target !== event.currentTarget) return;
          onRosterOpen((event.target as HTMLDetailsElement).open);
        }}
      >
        <summary>
          <span className="name">{copy.roster}</span>
          <span className="meta">{rows.length}</span>
        </summary>

        {loading ? <p className="meta">{copy.loading}</p> : null}
        {failed ? (
          <p className="meta">
            {copy.failed}{' '}
            <button type="button" className="quiet" onClick={onRetry}>
              {copy.retry}
            </button>
          </p>
        ) : null}
        {!loading && !failed && rows.length === 0 ? <p className="meta">{copy.empty}</p> : null}

        {rows.length > 0 ? (
          <div className="roster-tools">
            <RiwayaFilter
              rows={rows}
              selected={riwayat}
              labels={{ label: copy.filterRiwaya, all: copy.filterAll, count: copy.filterCount }}
              onChange={onRiwayat}
            />
            <SortBar
              sort={sort}
              onChange={onSort}
              labels={{
                label: copy.sortBy,
                name: copy.sortName,
                riwaya: copy.sortRiwaya,
                size: copy.sortSize,
                new: copy.sortNew,
              }}
            />
          </div>
        ) : null}

        <ul className="roster">
          {available.map((reciter) => (
            <li key={reciter.infohash} data-infohash={reciter.infohash}>
              <span className="row">
                <span>
                  <span className="name">
                    <ReciterName reciter={reciter} />
                    {reciter.complete ? null : <span className="tag">{copy.partial}</span>}
                  </span>
                  <span className="meta">
                    {reciter.riwaya} ·{' '}
                    {reciter.sizeBytes ? formatBytes(reciter.sizeBytes) : copy.unknownSize}
                  </span>
                </span>
              </span>
              <button type="button" className="action" onClick={() => onAdd(reciter.infohash)}>
                <PlusIcon /> {copy.add}
              </button>
            </li>
          ))}
        </ul>

        {available.length === 0 && rows.length > 0 ? <p className="meta">{copy.allHeld}</p> : null}
        <small>{copy.removeHint}</small>
      </details>

      {unpublished.length > 0 ? (
        <details className="group" open>
          <summary>
            <span className="name">{copy.unpublishedTitle}</span>
            <span className="meta">{unpublished.length}</span>
          </summary>
          <p className="meta">{copy.unpublishedLede}</p>
          <ul className="roster">
            {unpublished.map((reciter) => (
              <li key={reciter.infohash} data-infohash={reciter.infohash}>
                <span className="row">
                  <span>
                    <span className="name">{reciter.nameAr || reciter.name}</span>
                    <span className="meta">{formatBytes(reciter.sizeBytes ?? 0)}</span>
                  </span>
                </span>
                <button type="button" className="action" onClick={() => onRemoveUnpublished(reciter.infohash)}>
                  <TrashIcon /> {copy.remove}
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
