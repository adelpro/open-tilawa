import Icon from '@/components/icons';
import { useLocale } from '@/hooks/use-locale';

/**
 * The add-on's home: what it is, what it costs, and where it will be.
 *
 * The three store buttons are inert on purpose. A disabled control that looks
 * like a link teaches people that the site lies; until a listing exists there is
 * nothing to open, and the note under them says so.
 */
export default function ExtensionPage() {
  const { t } = useLocale();
  const copy = t.extensionPage;

  const browsers = [
    { key: 'chrome' as const, label: copy.browsers.chrome, icon: 'chrome' as const },
    { key: 'firefox' as const, label: copy.browsers.firefox, icon: 'firefox' as const },
    { key: 'edge' as const, label: copy.browsers.edge, icon: 'edge' as const },
  ];

  return (
    <main className="page-screen">
      <div className="w-full max-w-[520px] lg:max-w-[700px]">
        <h1 className="text-[3rem] font-semibold leading-[1.05] text-ink lg:text-[5rem]">{copy.title}</h1>
        <p className="mt-5 text-[1.125rem] leading-relaxed text-ink lg:text-[1.25rem]">{copy.lede}</p>

        <ul className="mt-8 space-y-2 text-[1rem] leading-relaxed text-ink">
          {copy.points.map((point) => (
            <li key={point} className="flex gap-3">
              <Icon name="check" size={16} className="mt-1 shrink-0 text-muted" />
              <span>{point}</span>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-wrap gap-3">
          {browsers.map((browser) => (
            <button
              key={browser.key}
              type="button"
              disabled
              aria-disabled="true"
              className="inline-flex min-h-11 cursor-not-allowed items-center gap-2 border border-line px-5 text-[0.9375rem] font-semibold text-muted"
            >
              <Icon name={browser.icon} size={20} />
              {browser.label}
              <span className="text-[0.75rem] font-normal">{copy.coming}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-1 text-[0.875rem] leading-relaxed text-muted">
          <p>{copy.note}</p>
          <p>{copy.noteLinks}</p>
        </div>

        <nav className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-6 text-[0.9375rem]">
          <a href="/privacy" className="press text-ink underline underline-offset-4">
            {copy.privacy}
          </a>
          <a
            href="https://adelpro.us.kg/open-tilawa/terms.html"
            className="press text-ink underline underline-offset-4"
          >
            {copy.terms}
          </a>
          <a
            href="https://github.com/adelpro/open-tilawa/issues"
            className="press text-ink underline underline-offset-4"
          >
            {copy.support}
          </a>
        </nav>
      </div>
    </main>
  );
}
