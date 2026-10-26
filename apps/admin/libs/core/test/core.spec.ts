import { CORE_VERSION } from '../src';

describe('core', () => {
  it('exposes a version', () => {
    expect(CORE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
