import Icon from '@/components/icons';
import { useLocale } from '@/hooks/use-locale';

export default function PrivacyPage() {
  const { t } = useLocale();

  return (
    <main className="page-screen">
      <div className="w-full max-w-[520px]">
        <a
          href="#/"
          className="inline-flex h-11 items-center gap-1 text-[14px] text-muted transition-colors hover:text-ink"
        >
          <Icon name="chevron-right" className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" />
          {t.routes.listen}
        </a>

        <h1 className="mt-6 text-[26px] font-semibold leading-tight text-ink">{t.privacy.title}</h1>

        <ul className="mt-6 space-y-4 text-[15px] leading-relaxed text-ink">
          <li>لا حساب، ولا تسجيل، ولا بريد إلكتروني.</li>
          <li>لا تحليلات ولا تتبّع إعلاني ولا بكسلات قياس.</li>
          <li>
            موضع الاستماع والقارئ المختار يُخزَّنان في متصفحك وحده (localStorage)، ويُحذفان بمسح
            بيانات الموقع.
          </li>
          <li>
            الاتصالات الخارجة ثلاثة فقط: كتالوج القرّاء، وشبكة التورنت (الأقران ومواقع الويب)،
            وروابط MP3 عند اختيار قارئ بلا ملف تورنت.
          </li>
          <li>لا نبيع شيئاً ولا نرسل بياناتك إلى أي طرف ثالث.</li>
        </ul>
      </div>
    </main>
  );
}
