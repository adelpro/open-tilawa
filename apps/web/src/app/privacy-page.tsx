import Icon from '@/components/icons';
import { useLocale } from '@/hooks/use-locale';

export default function PrivacyPage() {
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

        <h1 className="mt-6 text-[1.625rem] font-semibold leading-tight text-ink lg:text-[2rem]">{t.privacy.title}</h1>

        <ul className="mt-6 space-y-4 text-[1rem] leading-relaxed text-ink">
          {t.privacy.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </main>
  );
}
