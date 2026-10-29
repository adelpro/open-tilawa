import type { ReactElement } from 'react';
import {
  ArrowClockwiseIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CaretUpIcon,
  CheckIcon,
  DesktopIcon,
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
  GearSixIcon,
  GlobeIcon,
  InfoIcon,
  KeyIcon,
  ListIcon,
  LockIcon,
  MoonIcon,
  PlusIcon,
  PulseIcon,
  ShieldCheckIcon,
  SignOutIcon,
  SunIcon,
  UserIcon,
  XIcon,
} from '@phosphor-icons/react';
import type { Icon as PhosphorGlyph } from '@phosphor-icons/react';

/**
 * The icon set: Phosphor, mapped through one name.
 *
 * Call sites say `<Icon name="shield" />` and never import the library. The mapping
 * is the whole point: the name is the app's vocabulary ("the shield", "the key"),
 * while the glyph is a design decision that can be replaced here, once. Phosphor is
 * MIT and tree-shakes, so only the glyphs below reach the bundle.
 *
 * Icons are decoration: the label or the field name is the accessible name, so every
 * one is `aria-hidden`. An icon-only button gets its own `aria-label` at the call
 * site. `regular` is the only weight; `fill` is a state, not an emphasis. The 23
 * names below are the whole vocabulary — a name that no screen renders is deleted,
 * not kept for later, because every name in this map is a glyph in the bundle.
 */
export type IconName =
  | 'back'
  | 'plus'
  | 'refresh'
  | 'key'
  | 'lock'
  | 'mail'
  | 'check'
  | 'eye'
  | 'eyeOff'
  | 'menu'
  | 'close'
  | 'user'
  | 'settings'
  | 'shield'
  | 'logout'
  | 'globe'
  | 'sun'
  | 'moon'
  | 'monitor'
  | 'info'
  | 'pulse'
  | 'up'
  | 'down';

const GLYPHS: Record<IconName, PhosphorGlyph> = {
  back: CaretLeftIcon,
  plus: PlusIcon,
  refresh: ArrowClockwiseIcon,
  key: KeyIcon,
  lock: LockIcon,
  mail: EnvelopeIcon,
  check: CheckIcon,
  eye: EyeIcon,
  eyeOff: EyeSlashIcon,
  menu: ListIcon,
  close: XIcon,
  user: UserIcon,
  settings: GearSixIcon,
  shield: ShieldCheckIcon,
  logout: SignOutIcon,
  globe: GlobeIcon,
  sun: SunIcon,
  moon: MoonIcon,
  monitor: DesktopIcon,
  info: InfoIcon,
  pulse: PulseIcon,
  up: CaretUpIcon,
  down: CaretDownIcon,
};

export function Icon({
  name,
  size = 16,
  className = '',
  weight,
}: {
  name: IconName;
  size?: number;
  className?: string;
  weight?: 'regular' | 'fill';
}): ReactElement {
  const Glyph = GLYPHS[name];
  return (
    <Glyph
      className={`icon${name === 'back' ? ' icon-dir' : ''} ${className}`.trim()}
      size={size}
      weight={weight ?? 'regular'}
      aria-hidden="true"
      focusable="false"
    />
  );
}

/**
 * The spinner a busy button shows, in the slot its icon would occupy.
 *
 * A ring with one gap, rotated by the compositor. It is not a scale or a pulse: a spinner
 * has to read as "work is happening" at 12px, and rotation is the only shape that does at
 * that size. `prefers-reduced-motion` stops it turning and leaves a static ring, because a
 * button that says it is busy in words does not need a moving part.
 */
export function Spinner({ size = 14 }: { size?: number }): ReactElement {
  return (
    <svg
      className="spinner"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" opacity="0.25" />
      <path d="M12 3a9 9 0 0 1 9 9" />
    </svg>
  );
}
