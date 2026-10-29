import type { AlertEvent } from './notifications.rules';

/**
 * The words in an alert mail.
 *
 * The rules engine produces English `title`/`detail` for the console list and the
 * log. A mail is written in the recipient's language, so the sentence is built
 * here from the event's kind and parameters rather than translated from the
 * English afterwards — a translated sentence is how you get a mail that is half
 * Arabic and half a service name in the wrong place.
 */
type Locale = 'en' | 'ar';

export interface AlertWords {
  subject: string;
  heading: string;
  detail: string;
}

function gb(bytes: number | undefined): string {
  if (bytes === undefined) return '—';
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

const EN: Record<string, { open: string; resolved: string }> = {
  'service.down': { open: 'Service down', resolved: 'Service recovered' },
  'seeder.offline': { open: 'Node offline', resolved: 'Node back online' },
  'seeder.disk': { open: 'Disk space low', resolved: 'Disk space recovered' },
  'seeder.update_failed': { open: 'Node update failed', resolved: 'Node update recovered' },
};

const AR: Record<string, { open: string; resolved: string }> = {
  'service.down': { open: 'توقف خدمة', resolved: 'عادت الخدمة' },
  'seeder.offline': { open: 'توقف عقدة', resolved: 'عادت العقدة' },
  'seeder.disk': { open: 'انخفاض مساحة القرص', resolved: 'تحسّنت مساحة القرص' },
  'seeder.update_failed': { open: 'فشل تحديث عقدة', resolved: 'نجح تحديث العقدة' },
};

export function describeAlert(event: AlertEvent, locale: Locale): AlertWords {
  const words = (locale === 'ar' ? AR : EN)[event.kind] ?? {
    open: event.title,
    resolved: event.title,
  };
  const heading = event.action === 'open' ? words.open : words.resolved;
  const params = event.params ?? {};

  if (locale === 'ar') {
    const detail =
      event.kind === 'service.down'
        ? event.action === 'open'
          ? `تعذّر الوصول إلى الخدمة في آخر ${params.failures ?? 3} محاولات متتالية.`
          : 'استجابت الخدمة في آخر محاولتين متتاليتين.'
        : event.kind === 'seeder.offline'
          ? event.action === 'open'
            ? params.lastSeen
              ? `لم تستجب العقدة منذ ${params.lastSeen}.`
              : 'لم تسجّل العقدة أي اتصال بعد.'
            : 'استجابت العقدة في آخر استطلاع.'
          : event.kind === 'seeder.disk'
            ? event.action === 'open'
              ? `لم يتبقَّ في العقدة سوى ${gb(params.headroomBytes)} من المساحة الحرة.`
              : `بلغت المساحة الحرة ${gb(params.headroomBytes)}.`
            : event.action === 'open'
              ? `توقف التحديث بالخطأ التالي: ${params.error ?? event.detail ?? 'غير معروف'}`
              : 'اكتمل تحديث العقدة.';

    return { subject: `${heading} — ${event.name}`, heading, detail };
  }

  const detail =
    event.kind === 'service.down'
      ? event.action === 'open'
        ? `${params.failures ?? 3} consecutive checks failed.`
        : 'The service answered the last two checks.'
      : event.kind === 'seeder.offline'
        ? event.action === 'open'
          ? params.lastSeen
            ? `Not heard from since ${params.lastSeen}.`
            : 'It has never been seen.'
          : 'The last poll answered.'
        : event.kind === 'seeder.disk'
          ? event.action === 'open'
            ? `${gb(params.headroomBytes)} of headroom left.`
            : `${gb(params.headroomBytes)} free.`
          : event.action === 'open'
            ? `The update stopped with: ${params.error ?? event.detail ?? 'an unknown error'}`
            : 'The update finished.';

  return { subject: `${heading} — ${event.name}`, heading, detail };
}
