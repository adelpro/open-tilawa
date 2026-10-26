import { cn } from '@/utils/cn';

/**
 * Three bars that move only while audio is moving. On pause they freeze at a
 * legible mid-height — the row still says "this is where you are", without
 * pretending something is playing.
 */
export function Equalizer({ active, className }: { active: boolean; className?: string }) {
  return (
    <span
      className={cn('inline-flex h-3.5 w-3 items-end justify-between', className)}
      aria-hidden="true"
    >
      {[0, 1, 2].map((bar) => (
        <span
          key={bar}
          className="w-[2px] origin-bottom rounded-pill bg-current"
          style={{
            height: active ? '100%' : `${[55, 100, 70][bar]}%`,
            animation: active ? 'eq-bar 900ms ease-in-out infinite' : undefined,
            animationDelay: `${bar * 140}ms`,
          }}
        />
      ))}
    </span>
  );
}

/**
 * The one place cyan is allowed to appear: it says where the bytes come from.
 * `P2P` is the honest default; `HTTP` means an Itqan/web-seed fallback, not a
 * lesser mode.
 */
export function Fidelity({ p2p, className }: { p2p: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'badge-tech inline-flex items-center gap-1.5',
        p2p ? 'text-accent' : 'text-ink-secondary',
        className,
      )}
      title={
        p2p
          ? 'الصوت يصل من الأقران عبر التورنت'
          : 'الصوت يصل من روابط HTTP مباشرة، دون أقران'
      }
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          p2p ? 'bg-accent' : 'bg-ink-tertiary',
        )}
      />
      {p2p ? 'P2P' : 'HTTP'}
    </span>
  );
}
