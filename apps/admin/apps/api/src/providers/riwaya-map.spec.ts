import { describe, expect, it } from '@jest/globals';
import { mapRiwaya } from './riwaya-map';

describe('mapRiwaya', () => {
  it('maps the English spellings the providers use', () => {
    expect(mapRiwaya('Hafs an Aasim')).toBe('Hafs');
    expect(mapRiwaya("Rewayat Hafs A'n Assem - Murattal")).toBe('Hafs');
    expect(mapRiwaya('Warsh an Nafi')).toBe('Warsh');
    expect(mapRiwaya('Qalun an Nafi')).toBe('Qalon');
    expect(mapRiwaya('Al-Douri')).toBe('al-Douri');
    expect(mapRiwaya("Shu'bah 'an 'Asim")).toBe('Shubah an asim');
  });

  it('maps the Arabic names', () => {
    expect(mapRiwaya('حفص عن عاصم')).toBe('Hafs');
    expect(mapRiwaya('ورش عن نافع')).toBe('Warsh');
    expect(mapRiwaya('قالون عن نافع')).toBe('Qalon');
    expect(mapRiwaya('الدوري')).toBe('al-Douri');
    expect(mapRiwaya('شعبة عن عاصم')).toBe('Shubah an asim');
  });

  it('never guesses an unknown reading', () => {
    expect(mapRiwaya('Murattal')).toBe('unknown');
    expect(mapRiwaya('')).toBe('unknown');
    expect(mapRiwaya(null)).toBe('unknown');
  });
});
