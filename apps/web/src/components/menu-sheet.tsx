import Icon from '@/components/icons';
import Sheet from '@/components/sheet';
import { APP_VERSION } from '@/constants/version';
import type { Theme } from '@/hooks/use-theme';
import { cn } from '@/utils/cn';

const row =
  'flex h-14 w-full items-center justify-between px-5 text-start text-[15px] text-ink transition-colors hover:bg-line active:bg-line';

function segment(active: boolean) {
  return cn(
    'h-8 rounded-full px-3 text-[13px] transition-colors',
    active ? 'bg-ink text-invert' : 'text-muted hover:text-ink',
  );
}

/** The one door in the top bar. Settings first, pages second, version last. */
export function MenuSheet({
  open,
  onClose,
  theme,
  onTheme,
  reciterName,
  onOpenReciters,
  onOpenAbout,
  onOpenPrivacy,
}: {
  open: boolean;
  onClose: () => void;
  theme: Theme;
  onTheme: (theme: Theme) => void;
  reciterName: string;
  onOpenReciters: () => void;
  onOpenAbout: () => void;
  onOpenPrivacy: () => void;
}) {
  return (
    <Sheet title="الإعدادات" open={open} onClose={onClose} size="auto">
      <div className="pb-3">
        <button type="button" onClick={onOpenReciters} className={row}>
          <span className="flex items-center gap-2">
            <span>القارئ</span>
            <span className="text-[13px] text-muted">{reciterName}</span>
          </span>
          <Icon name="chevron-left" className="h-4 w-4 text-muted" />
        </button>

        <div className="flex h-14 items-center justify-between px-5">
          <span className="text-[15px]">المظهر</span>
          <div
            role="group"
            aria-label="المظهر"
            className="flex items-center rounded-full border border-line p-0.5"
          >
            <button
              type="button"
              onClick={() => onTheme('light')}
              aria-pressed={theme === 'light'}
              className={segment(theme === 'light')}
            >
              فاتح
            </button>
            <button
              type="button"
              onClick={() => onTheme('dark')}
              aria-pressed={theme === 'dark'}
              className={segment(theme === 'dark')}
            >
              داكن
            </button>
          </div>
        </div>

        <div className="flex h-14 items-center justify-between px-5">
          <span className="text-[15px]">اللغة</span>
          <div className="flex items-center gap-2 text-[13px]">
            <span className="rounded-full bg-ink px-3 py-1 font-semibold text-invert">العربية</span>
            <span aria-disabled="true" className="px-1 text-muted">
              English
            </span>
            <span className="text-[11px] text-muted">قريباً</span>
          </div>
        </div>

        <button type="button" onClick={onOpenAbout} className={row}>
          <span>عن تلاوة</span>
          <Icon name="chevron-left" className="h-4 w-4 text-muted" />
        </button>
        <button type="button" onClick={onOpenPrivacy} className={row}>
          <span>الخصوصية</span>
          <Icon name="chevron-left" className="h-4 w-4 text-muted" />
        </button>

        <p className="tnum px-5 pt-2 text-[11px] text-muted">{APP_VERSION}</p>
      </div>
    </Sheet>
  );
}

export function AboutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet title="عن تلاوة" open={open} onClose={onClose}>
      <div className="px-5 py-6 text-[14px] leading-relaxed">
        {/* The PNG is a navy raster with a baked matte; on the dark theme it
            would be a dark mark on black. The wordmark is type, so it works in
            both themes and matches the top bar. */}
        <p className="font-display mb-5 text-[34px] leading-none text-ink">تلاوة</p>

        <p className="text-ink">
          تلاوة تطبيق لسماع القرآن الكريم، يبثّ التلاوات عبر الشبكة الندّية بدل خوادم مركزية، ويعمل
          من المتصفح دون حساب.
        </p>
        <p className="mt-3 text-muted">
          المصحف مرتّب على ترتيب المصحف، ولكل قارئ ملف واحد لكل سورة. عند تعطّل الشبكة الندّية يعود
          التطبيق إلى روابط MP3 المباشرة حين تتوفّر.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <a
            href="https://github.com/adelpro/open-tilawa"
            target="_blank"
            rel="noreferrer"
            className="text-ink underline underline-offset-4"
          >
            الكود المصدري
          </a>
          <a href="mailto:adelpro@gmail.com" className="text-ink underline underline-offset-4">
            adelpro@gmail.com
          </a>
        </div>

        <p className="mt-6 text-[12px] text-muted">
          الخطوط: IBM Plex Sans Arabic و Amiri، رخصة SIL OFL 1.1. الإصدار{' '}
          <span className="tnum">{APP_VERSION}</span>.
        </p>
      </div>
    </Sheet>
  );
}

export function PrivacySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet title="الخصوصية" open={open} onClose={onClose}>
      <ul className="space-y-4 px-5 py-6 text-[14px] leading-relaxed text-ink">
        <li>لا حساب، ولا تسجيل، ولا بريد إلكتروني.</li>
        <li>لا تحليلات ولا تتبّع إعلاني ولا بكسلات قياس.</li>
        <li>
          موضع الاستماع والمظهر والسرعة تُخزَّن في متصفحك وحده (localStorage)، وتُحذف بمسح بيانات
          الموقع.
        </li>
        <li>
          الاتصالات الخارجة ثلاثة فقط: كتالوج القرّاء، وشبكة التورنت (الأقران ومواقع الويب)، وروابط
          MP3 عند اختيار قارئ بلا ملف تورنت.
        </li>
        <li>لا نبيع شيئاً ولا نرسل بياناتك إلى أي طرف ثالث.</li>
      </ul>
    </Sheet>
  );
}
