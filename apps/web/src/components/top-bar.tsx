import Icon from '@/components/icons';

/**
 * 56px of brand and one door. Two elements, because three tappable things
 * beside a wordmark crowd the right edge of a 390px screen — theme and
 * language live one tap deeper, in the menu.
 */
export default function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <header className="shrink-0 border-b border-line">
      <div className="mx-auto flex h-14 w-full max-w-[520px] items-center justify-between px-4">
        <span className="font-display text-[18px] font-semibold leading-none text-ink">تلاوة</span>

        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="القائمة"
          aria-haspopup="dialog"
          className="-me-2 flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:text-ink active:bg-line"
        >
          <Icon name="dots" />
        </button>
      </div>
    </header>
  );
}
