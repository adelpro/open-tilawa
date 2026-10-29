import Icon from '@/components/icons';
import { APP_VERSION } from '@/constants/version';
import { useLocale } from '@/hooks/use-locale';

/** A page, not a sheet: it has a URL (`#/about`), so it can be linked and reloaded. */
export default function AboutPage() {
  const { t } = useLocale();
  const about = t.about;

  return (
    <main className="page-screen">
      <div className="w-full max-w-[520px] lg:max-w-[700px]">
        <a
          href="#/"
          className="inline-flex min-h-11 items-center gap-2 text-[0.875rem] text-muted transition-colors hover:text-ink"
        >
          <Icon name="back" className="text-muted" />
          {t.routes.listen}
        </a>

        {/* No second logo here: the header already carries the mark. */}
        <h1 className="mt-6 text-[1.625rem] font-semibold leading-tight text-ink lg:text-[2rem]">{about.title}</h1>

        <p className="mt-6 text-[1rem] leading-relaxed text-ink">{about.lede}</p>

        <section className="mt-10">
          <h2 className="text-[1.25rem] font-semibold leading-snug text-ink">{about.how.title}</h2>
          <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.how.p1}</p>
          <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.how.p2}</p>
        </section>

        <section className="mt-10">
          <h2 className="text-[1.25rem] font-semibold leading-snug text-ink">
            {about.noPeers.title}
          </h2>
          <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.noPeers.p1}</p>
          <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.noPeers.p2}</p>
          <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.noPeers.p3}</p>
        </section>

        <section className="mt-10">
          <h2 className="text-[1.25rem] font-semibold leading-snug text-ink">{about.ring.title}</h2>
          <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.ring.p1}</p>
          <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.ring.p2}</p>
        </section>

        <section className="mt-10">
          <h2 className="text-[1.25rem] font-semibold leading-snug text-ink">{about.know.title}</h2>
          <ul className="mt-3 space-y-3 text-[1rem] leading-relaxed text-muted">
            {about.know.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-[1.25rem] font-semibold leading-snug text-ink">
            {about.sources.title}
          </h2>
          <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.sources.p1}</p>
          <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.sources.p2}</p>
        </section>

        <section className="mt-10">
          <h2 className="text-[1.25rem] font-semibold leading-snug text-ink">{about.open.title}</h2>
          <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.open.p1}</p>
          <div className="mt-4 flex flex-col gap-2 text-[1rem] leading-relaxed">
            <p className="text-muted">
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
            <p className="text-muted">
              {about.open.report}{' '}
              <a
                href="mailto:contact@tilawah.cc"
                dir="ltr"
                className="inline-block text-ink underline underline-offset-4"
              >
                contact@tilawah.cc
              </a>
            </p>
          </div>
        </section>

        <p className="mt-10 text-[1rem] leading-relaxed text-ink">{about.closing}</p>

        <p className="mt-8 text-[0.75rem] leading-relaxed text-muted">
          {about.license} <span className="tnum">{APP_VERSION}</span>.
        </p>
      </div>
    </main>
  );
}
