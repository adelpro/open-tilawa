import Icon from '@/components/icons';
import Link from '@/components/link';
import { APP_VERSION } from '@/constants/version';
import { useLocale } from '@/hooks/use-locale';

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

        <section className="mt-10">
          <h2 className="text-[1.25rem] font-semibold leading-snug text-ink">{about.how.title}</h2>
          <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.how.p1}</p>
          <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.how.p2}</p>
          <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.how.p3}</p>
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
          <h2 className="text-[1.25rem] font-semibold leading-snug text-ink">
            {about.sync.title}
          </h2>
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
        </section>

        <section className="mt-10">
          <h2 className="text-[1.25rem] font-semibold leading-snug text-ink">
            {about.sources.title}
          </h2>
          <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.sources.p1}</p>
          <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.sources.p2}</p>
          <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.sources.p3}</p>
          <a
            href="https://itqan.dev"
            target="_blank"
            rel="noreferrer"
            className="group mt-4 inline-flex min-h-11 items-center gap-3"
          >
            <img src="/images/itqan.png" alt="" aria-hidden="true" className="itqan-mark h-12 w-auto" />
            <span className="text-[0.875rem] text-muted underline underline-offset-4 transition-colors group-hover:text-ink">
              {about.sources.link}
            </span>
          </a>
        </section>

        <section className="mt-10">
          <h2 className="text-[1.25rem] font-semibold leading-snug text-ink">{about.faq.title}</h2>
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
        </section>

        <section className="mt-10">
          <h2 className="text-[1.25rem] font-semibold leading-snug text-ink">{about.open.title}</h2>
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
        </section>

        <section className="mt-10">
          <h2 className="text-[1.25rem] font-semibold leading-snug text-ink">{about.node.title}</h2>
          <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.node.p1}</p>
          <p className="mt-3 text-[1rem] leading-relaxed text-muted">{about.node.p2}</p>
          <Link
            to={{ name: 'seed' }}
            className="mt-4 inline-flex min-h-11 items-center text-[1rem] text-ink underline underline-offset-4"
          >
            {about.node.link}
          </Link>
        </section>

        <p className="mt-10 text-[1rem] leading-relaxed text-ink">{about.closing}</p>

        <p className="mt-8 text-[0.75rem] leading-relaxed text-muted">
          {about.license} <span className="tnum">{APP_VERSION}</span>.
        </p>
      </div>
    </main>
  );
}
