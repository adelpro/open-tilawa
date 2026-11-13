import type { ReactNode } from 'react';

import Icon from '@/components/icons';
import Link from '@/components/link';
import { APP_VERSION } from '@/constants/version';
import { useLocale } from '@/hooks/use-locale';

/**
 * A section a reader opens, below the intro.
 *
 * Native `<details>`, so the words are in the document whether or not it is
 * expanded — a crawler reads the whole page without running anything, and a
 * reader without JavaScript can still open every section. The heading stays
 * inside `<summary>` (the spec allows heading content there), so the page keeps
 * its outline and `#sync`-style links still land on the right row.
 */
function Fold({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <details id={id} className="mt-4 scroll-mt-24 border-b border-line/60 pb-4">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3">
        <h2 className="text-[1.25rem] font-semibold leading-snug text-ink">{title}</h2>
        <Icon
          name="forward"
          size={16}
          className="icon-dir shrink-0 text-muted transition-transform [details[open]_&]:rotate-90"
        />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

/** A page, not a sheet: it has a URL, so it can be linked and reloaded. */
export default function AboutPage() {
  const { t } = useLocale();
  const about = t.about;

  return (
    <main className="page-screen">
      <div className="w-full max-w-[520px] lg:max-w-[700px]">
        <Link
          to={{ name: 'home' }}
          className="inline-flex min-h-11 items-center gap-2 text-[0.875rem] text-muted transition-colors hover:text-ink"
        >
          <Icon name="back" className="text-muted" />
          {t.routes.listen}
        </Link>

        <h1 className="mt-6 text-[1.625rem] font-semibold leading-tight text-ink lg:text-[2rem]">
          {about.title}
        </h1>

        <p className="mt-6 text-[1rem] leading-relaxed text-ink">{about.lede}</p>
        <p className="mt-3 text-[1rem] leading-relaxed text-ink">{about.lede2}</p>

        <div className="mt-6">
          <Fold id="how" title={about.how.title}>
            <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.how.p1}</p>
            <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.how.p2}</p>
            <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.how.p3}</p>
          </Fold>

          <Fold id="peers" title={about.noPeers.title}>
            <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.noPeers.p1}</p>
            <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.noPeers.p2}</p>
            <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.noPeers.p3}</p>
          </Fold>

          <Fold id="sync" title={about.sync.title}>
            <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.sync.p1}</p>
            <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.sync.p2}</p>
            <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.sync.p3}</p>
            <h3 className="mt-6 text-[1rem] font-semibold text-ink">{about.sync.what.title}</h3>
            <ul className="mt-3 space-y-2 text-[1rem] leading-relaxed text-muted">
              {about.sync.what.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="mt-4 text-[1rem] leading-relaxed text-muted">{about.sync.position}</p>
          </Fold>

          <Fold id="sources" title={about.sources.title}>
            <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.sources.p1}</p>
            <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.sources.p2}</p>
            <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.sources.p3}</p>
            <div className="mt-4 flex flex-wrap items-center gap-6">
              <a
                href="https://itqan.dev"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center"
              >
                <img src="/images/itqan.png" alt="Itqan" className="source-mark h-10 w-auto" />
              </a>
              <a
                href="https://mp3quran.net"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center"
              >
                <img src="/images/mp3quran.png" alt="MP3Quran" className="source-mark h-10 w-auto" />
              </a>
            </div>
          </Fold>

          <Fold id="faq" title={about.faq.title}>
            <dl className="mt-4 space-y-5">
              {about.faq.items.map((item) => (
                <div key={item.q}>
                  <dt className="text-[1rem] font-semibold leading-snug text-ink">{item.q}</dt>
                  <dd className="mt-1 text-[1rem] leading-relaxed text-muted">{item.a}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-[1rem] leading-relaxed">
              <a
                href={`mailto:${about.faq.contact}`}
                dir="ltr"
                className="inline-block text-ink underline underline-offset-4"
              >
                {about.faq.contact}
              </a>
            </p>
          </Fold>

          <Fold id="open-source" title={about.open.title}>
            <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.open.p1}</p>
            <p className="mt-4 text-[1rem] leading-relaxed text-muted">
              {about.open.source}{' '}
              <a
                href="https://github.com/adelpro/open-tilawa"
                target="_blank"
                rel="noreferrer"
                dir="ltr"
                className="inline-block text-ink underline underline-offset-4"
              >
                github.com/adelpro/open-tilawa
              </a>
            </p>
          </Fold>

          <Fold id="node" title={about.node.title}>
            <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.node.p1}</p>
            <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.node.p2}</p>
            <Link
              to={{ name: 'seed' }}
              className="mt-4 inline-flex min-h-11 items-center text-[1rem] text-ink underline underline-offset-4"
            >
              {about.node.link}
            </Link>
          </Fold>
        </div>

        <p className="mt-10 text-[1rem] leading-relaxed text-ink">{about.closing}</p>

        <p className="mt-8 text-[0.75rem] leading-relaxed text-muted">
          {about.license} <span className="tnum">{APP_VERSION}</span>.
        </p>
      </div>
    </main>
  );
}
