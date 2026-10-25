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

/**
 * The two brands. These are the owners' artwork, not ours, so they keep their own colours
 * and are never tinted with `currentColor` — recolouring a sign-in mark is a licensing
 * problem before it is a design one. Sizes follow each brand's guidance: at least 18px,
 * proportionate clearspace, unmodified geometry.
 */
export function GoogleMark({ size = 18 }: { size?: number }): ReactElement {
  return (
    <svg
      className="icon icon--brand"
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.8 6c1.9-5.6 7.1-9.8 13.7-9.8z"
      />
      <path
        fill="#4285F4"
        d="M46.1 24.6c0-1.6-.1-2.8-.4-4.1H24v9.3h12.6c-.3 2.1-1.6 5.2-4.6 7.3l7.6 5.9c4.5-4.2 6.5-10.3 6.5-18.4z"
      />
      <path
        fill="#FBBC05"
        d="M10.3 28.7A14.6 14.6 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.5 10.7l7.8-6z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2 1.4-4.7 2.4-8.3 2.4-6.6 0-11.8-4.2-13.7-9.9l-7.8 6C6.4 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}

export function GitHubMark({ size = 18 }: { size?: number }): ReactElement {
  return (
    <svg
      className="icon icon--brand"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      fill="currentColor"
    >
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.4.7-4.1-1.4-4.1-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.6-1.4-5.6-6.1 0-1.3.5-2.5 1.2-3.4-.1-.3-.5-1.6.1-3.3 0 0 1-.3 3.4 1.3a11.6 11.6 0 0 1 6.2 0c2.4-1.6 3.4-1.3 3.4-1.3.6 1.7.2 3 .1 3.3.8.9 1.2 2.1 1.2 3.4 0 4.7-2.9 5.8-5.6 6.1.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3z" />
    </svg>
  );
}
