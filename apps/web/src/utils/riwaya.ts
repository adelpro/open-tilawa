/**
 * The catalogue stores the riwaya in Latin (`Hafs`, `Warsh`, `Qalon`). The list
 * is Arabic, so the label is Arabic too; anything unknown is shown as it came.
 */
const NAMES: Record<string, string> = {
  hafs: 'حفص',
  warsh: 'ورش',
  qalon: 'قالون',
  qalun: 'قالون',
  'shubah an asim': 'شعبة عن عاصم',
  'al-duri': 'الدوري',
};

export function riwayaLabel(riwaya: string | undefined): string {
  const key = (riwaya ?? '').trim().toLowerCase();
  return NAMES[key] ?? riwaya?.trim() ?? 'حفص';
}
