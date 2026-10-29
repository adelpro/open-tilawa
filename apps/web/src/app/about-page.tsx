import Icon from '@/components/icons';
import { APP_VERSION } from '@/constants/version';
import { useLocale } from '@/hooks/use-locale';

/** A page, not a sheet: it has a URL (`#/about`), so it can be linked and reloaded. */
export default function AboutPage() {
  const { t } = useLocale();

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
        <h1 className="mt-6 text-[1.625rem] font-semibold leading-tight text-ink lg:text-[2rem]">{t.about.title}</h1>

        <p className="mt-6 text-[1rem] leading-relaxed text-ink">{t.about.body1}</p>
        <p className="mt-3 text-[1rem] leading-relaxed text-muted">{t.about.body2}</p>
        <p className="mt-3 text-[1rem] leading-relaxed text-muted">{t.about.body3}</p>
        <p className="mt-3 text-[1rem] leading-relaxed text-muted">{t.about.body4}</p>
        <p className="mt-3 text-[1rem] leading-relaxed text-muted">{t.about.itqan}</p>

        <div className="mt-8 flex flex-col gap-3 text-[1rem]">
          <a
            href="https://github.com/adelpro/open-tilawa"
            target="_blank"
            rel="noreferrer"
            className="text-ink underline underline-offset-4"
          >
            {t.about.source}
          </a>
          <a href="mailto:adelpro@gmail.com" className="text-ink underline underline-offset-4">
            adelpro@gmail.com
          </a>
        </div>

        <p className="mt-8 text-[0.75rem] leading-relaxed text-muted">
          {t.about.license}{' '}
          <span className="tnum">{APP_VERSION}</span>.
        </p>
      </div>
    </main>
  );
}
