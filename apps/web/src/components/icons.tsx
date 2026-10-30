import type { ReactElement } from 'react';
import {
  BookOpen,
  CaretDown,
  CaretLeft,
  CaretRight,
  Check,
  DownloadSimple,
  DotsThreeVertical,
  File,
  Gauge,
  GearSix,
  GlobeHemisphereWest,
  HardDrives,
  Headphones,
  Heart,
  House,
  Info,
  Key,
  LinkSimple,
  MagnifyingGlass,
  Microphone,
  Moon,
  MoonStars,
  Pause,
  PencilSimple,
  Play,
  Pulse,
  PushPin,
  ShieldCheck,
  SpeakerHigh,
  SpeakerSlash,
  Sun,
  UploadSimple,
  User,
  Users,
  Waveform,
  WifiHigh,
  X,
} from '@phosphor-icons/react';
import type { Icon as PhosphorGlyph } from '@phosphor-icons/react';

import { cn } from '@/utils/cn';

/**
 * The icon set: Phosphor, mapped through one name.
 *
 * Call sites say `<Icon name="heart" />` and never import the library, so the
 * name is the app's vocabulary ("the favourite", "the list") and the glyph is a
 * design decision made here, once.
 *
 * Three sizes, no more: 16 with text, 20 for a standalone control, 24 for a
 * card or a section head. `regular` is the only weight; `fill` is a *state*
 * (a favourite, the active tab), never an optical choice — bold at 18px is
 * twice the stroke of regular at 16 and that mismatch is what made two glyph
 * systems look like two apps.
 *
 * Phosphor renders a bare <svg> with no role and no aria, so every icon is
 * hidden here: the label, the field name or the button's aria-label is the
 * accessible name, and an icon that repeats it makes a screen reader say it
 * twice.
 *
 * `wifi-waiting` is the one glyph Phosphor cannot supply: its arcs answer one
 * after another while no peer is seeding, and the animation is CSS (`.wifi-arc`
 * in globals.css) so the global reduced-motion rule can switch it off. It is
 * drawn on the same 1/16 optical stroke as Phosphor regular, so it sits beside
 * the rest without a seam.
 */
export type IconName =
  | 'back'
  | 'forward'
  | 'expand'
  | 'play'
  | 'pause'
  | 'wifi'
  | 'wifi-waiting'
  | 'link'
  | 'mic'
  | 'search'
  | 'close'
  | 'volume'
  | 'volume-x'
  | 'users'
  | 'download'
  | 'upload'
  | 'file'
  | 'activity'
  | 'server'
  | 'house'
  | 'book'
  | 'gear'
  | 'info'
  | 'shield'
  | 'key'
  | 'user'
  | 'more'
  | 'edit'
  | 'sun'
  | 'moon'
  | 'globe'
  | 'gauge'
  | 'sleep'
  | 'waveform'
  | 'heart'
  | 'headphones'
  | 'pin'
  | 'check';

/** 16 with text, 20 for a control, 24 for a card. Nothing else. */
export type IconSize = 16 | 20 | 24;

const GLYPHS: Record<Exclude<IconName, 'wifi-waiting'>, PhosphorGlyph> = {
  back: CaretLeft,
  forward: CaretRight,
  expand: CaretDown,
  play: Play,
  pause: Pause,
  wifi: WifiHigh,
  link: LinkSimple,
  mic: Microphone,
  search: MagnifyingGlass,
  close: X,
  volume: SpeakerHigh,
  'volume-x': SpeakerSlash,
  users: Users,
  download: DownloadSimple,
  upload: UploadSimple,
  file: File,
  activity: Pulse,
  server: HardDrives,
  house: House,
  book: BookOpen,
  gear: GearSix,
  info: Info,
  shield: ShieldCheck,
  key: Key,
  user: User,
  more: DotsThreeVertical,
  edit: PencilSimple,
  check: Check,
  sun: Sun,
  moon: Moon,
  globe: GlobeHemisphereWest,
  gauge: Gauge,
  sleep: MoonStars,
  waveform: Waveform,
  heart: Heart,
  headphones: Headphones,
  pin: PushPin,
};

/** The one local glyph: three arcs that answer in turn while nothing seeds. */
function WifiGlyph({ size = 16 }: { size?: number }): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path className="wifi-arc" d="M4.5 9.5a11 11 0 0 1 15 0" />
      <path className="wifi-arc wifi-arc-2" d="M7.8 13a6.5 6.5 0 0 1 8.4 0" />
      <path className="wifi-dot" d="M10.9 16.4a2.2 2.2 0 0 1 2.2 0" />
    </svg>
  );
}

/** `back` and `forward` are directions, not sides: the arrow flips in RTL. */
function isDirectional(name: IconName): boolean {
  return name === 'back' || name === 'forward';
}

/**
 * The one busy indicator: a ring with a gap, rotated by the compositor.
 *
 * It replaces the icon slot in a button so the label never moves, and it is
 * aria-hidden because the control that owns it carries `aria-busy`. The global
 * reduced-motion rule freezes it, which is fine: a button that says it is busy
 * in words does not need a moving part.
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

export default function Icon({
  name,
  size = 16,
  weight = 'regular',
  className,
}: {
  name: IconName;
  size?: IconSize;
  weight?: 'regular' | 'fill';
  className?: string;
}): ReactElement {
  if (name === 'wifi-waiting') {
    return <WifiGlyph size={size} />;
  }

  const Glyph = GLYPHS[name];
  return (
    <Glyph
      size={size}
      weight={weight}
      aria-hidden="true"
      focusable="false"
      className={cn('icon', isDirectional(name) && 'icon-dir', className)}
    />
  );
}
