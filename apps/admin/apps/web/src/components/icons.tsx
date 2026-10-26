import type { ReactElement } from 'react';
import {
  ArrowDownIcon,
  ArrowSquareOutIcon,
  ArrowUpIcon,
  ChartBarIcon,
  CheckIcon,
  CopyIcon,
  DesktopIcon,
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
  GearSixIcon,
  GlobeIcon,
  KeyIcon,
  ListIcon,
  LockIcon,
  MoonIcon,
  PencilSimpleIcon,
  PlusIcon,
  ShieldCheckIcon,
  SignOutIcon,
  SunIcon,
  TrashIcon,
  UserIcon,
  XIcon,
} from '@phosphor-icons/react';
import type { Icon as PhosphorGlyph } from '@phosphor-icons/react';

/**
 * The icon set: Phosphor, mapped through one name.
 *
 * Call sites say `<Icon name="trash" />` and never import the library. The mapping
 * is the whole point: the name is the app's vocabulary ("the bin", "the shield"),
 * while the glyph is a design decision that can be replaced here, once. Phosphor is
 * MIT and tree-shakes, so only the glyphs below reach the bundle.
 *
 * Icons are decoration: the label or the field name is the accessible name, so every
 * one is `aria-hidden`. An icon-only button gets its own `aria-label` at the call
 * site. The default `regular` weight is 1px at 16px, within a hair of the 1.75/24
 * stroke of the glyphs this replaced; the heavier weights are there for emphasis,
 * not as the house default. Each glyph carries all six weights, so the 25 names below
 * cost about 17 kB gzipped — the price of not drawing and maintaining them.
 */
export type IconName =
  | 'plus'
  | 'copy'
  | 'edit'
  | 'trash'
  | 'key'
  | 'lock'
  | 'mail'
  | 'check'
  | 'external'
  | 'eye'
  | 'eyeOff'
  | 'menu'
  | 'close'
  | 'user'
  | 'chart'
  | 'settings'
  | 'shield'
  | 'logout'
  | 'globe'
  | 'sun'
  | 'moon'
  | 'monitor'
  | 'up'
  | 'down';

const GLYPHS: Record<IconName, PhosphorGlyph> = {
  plus: PlusIcon,
  copy: CopyIcon,
  edit: PencilSimpleIcon,
  trash: TrashIcon,
  key: KeyIcon,
  lock: LockIcon,
  mail: EnvelopeIcon,
  check: CheckIcon,
  external: ArrowSquareOutIcon,
  eye: EyeIcon,
  eyeOff: EyeSlashIcon,
  menu: ListIcon,
  close: XIcon,
  user: UserIcon,
  chart: ChartBarIcon,
  settings: GearSixIcon,
  shield: ShieldCheckIcon,
  logout: SignOutIcon,
  globe: GlobeIcon,
  sun: SunIcon,
  moon: MoonIcon,
  monitor: DesktopIcon,
  up: ArrowUpIcon,
  down: ArrowDownIcon,
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
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
}): ReactElement {
  const Glyph = GLYPHS[name];
  return (
    <Glyph
      className={`icon ${className}`.trim()}
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
