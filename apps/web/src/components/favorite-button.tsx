import { Heart } from '@phosphor-icons/react';

import { useFavorites } from '@/hooks/use-favorites';
import { useLocale } from '@/hooks/use-locale';
import { cn } from '@/utils/cn';

export default function FavoriteButton({
  reciterId,
  className,
}: {
  reciterId: number | string;
  className?: string;
}) {
  const { t } = useLocale();
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(reciterId);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggle(reciterId);
      }}
      aria-pressed={active}
      aria-label={active ? t.sheets.removeFavorite : t.sheets.addFavorite}
      title={active ? t.sheets.removeFavorite : t.sheets.addFavorite}
      className={cn('inline-flex items-center justify-center', className)}
    >
      <Heart
        size={17}
        weight={active ? 'fill' : 'regular'}
        className={active ? 'text-ink' : 'text-muted'}
      />
    </button>
  );
}
