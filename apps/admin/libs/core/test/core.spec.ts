import { CORE_VERSION, ENGINE_NOTES } from '../src/index';

describe('core', () => {
  it('exposes a version', () => {
    expect(CORE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('records that inference is client-side', () => {
    expect(ENGINE_NOTES.inference).toContain('client-side');
  });
});
