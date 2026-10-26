import Icon from '@/components/icons';
import { APP_VERSION } from '@/constants/version';

/** A page, not a sheet: it has a URL (`#/about`), so it can be linked and reloaded. */
export default function AboutPage() {
  return (
    <main className="page-screen">
      <div className="w-full max-w-[520px]">
        <a
          href="#/"
          className="inline-flex h-11 items-center gap-1 text-[14px] text-muted transition-colors hover:text-ink"
        >
          <Icon name="chevron-right" className="h-4 w-4" />
          الاستماع
        </a>

        {/* No second logo here: the header already carries the mark. */}
        <h1 className="mt-6 text-[26px] font-semibold leading-tight text-ink">عن تلاوة</h1>

        <p className="mt-6 text-[15px] leading-relaxed text-ink">
          تلاوة تطبيق لسماع القرآن الكريم، يبثّ التلاوات عبر الشبكة الندّية بدل خوادم مركزية، ويعمل
          من المتصفح دون حساب.
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          المصحف مرتّب على ترتيب المصحف، ولكل قارئ ملف واحد لكل سورة. عند تعطّل الشبكة الندّية يعود
          التطبيق إلى روابط MP3 المباشرة حين تتوفّر.
        </p>

        <div className="mt-8 flex flex-col gap-3 text-[15px]">
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

        <p className="mt-8 text-[12px] leading-relaxed text-muted">
          الخطوط: IBM Plex Sans Arabic، رخصة SIL OFL 1.1. الإصدار{' '}
          <span className="tnum">{APP_VERSION}</span>.
        </p>
      </div>
    </main>
  );
}
