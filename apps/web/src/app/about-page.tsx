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
          className="inline-flex h-11 items-center gap-1 text-[14px] text-muted transition-colors hover:text-ink"
        >
          <Icon name="chevron-right" className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" />
          {t.routes.listen}
        </a>

        {/* No second logo here: the header already carries the mark. */}
        <h1 className="mt-6 text-[26px] font-semibold leading-tight text-ink lg:text-[32px]">{t.about.title}</h1>

        <p className="mt-6 text-[15px] leading-relaxed text-ink">{t.about.body1}</p>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">{t.about.body2}</p>

        <div className="mt-8 flex flex-col gap-3 text-[15px]">
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

        <p className="mt-8 text-[12px] leading-relaxed text-muted">
          {t.about.license}{' '}
          <span className="tnum">{APP_VERSION}</span>.
        </p>
      </div>
    </main>
  );
}
