import { useLocale } from '@/hooks/use-locale';

/**
 * What a path that names nothing renders.
 *
 * The hash router quietly fell back to the player for any unknown route, which on real
 * paths would be a soft 404 on every typo — a page that answers 200 and says nothing. This
 * screen exists so the app can say "not here" while the edge says `404`.
 */
export default function NotFoundPage({ onHome }: { onHome: () => void }) {
  const { t } = useLocale();

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-5 py-16">
      <h1 className="text-2xl font-semibold text-ink">{t.notFound.title}</h1>
      <p className="text-base text-muted">{t.notFound.body}</p>
      <button
        type="button"
        onClick={onHome}
        className="self-start rounded-lg border border-line px-4 py-2 text-sm text-ink hover:bg-surface"
      >
        {t.notFound.home}
      </button>
    </main>
  );
}
