/**
 * The catalogue stores the riwaya in Latin (`Hafs`, `Warsh`, `Qalon`). The list
 * is Arabic, so the label is Arabic too; anything unknown is shown as it came.
 */
const NAMES: Record<string, string> = {
  hafs: 'حفص',
  warsh: 'ورش',
  qalon: 'قالون',
  qalun: 'قالون',
  unknown: 'غير محدّد',
  'shubah an asim': 'شعبة عن عاصم',
  'al-douri': 'الدوري',
  'al-duri': 'الدوري',
};

/**
 * The reading is a fact about the recording, not a default. A row nobody has
 * classified says so; assuming Hafs made every unclassified filter useless.
 */
export function riwayaLabel(riwaya: string | undefined): string {
  const key = (riwaya ?? '').trim().toLowerCase();
  return NAMES[key] ?? (riwaya?.trim() || 'غير محدّد');
}
