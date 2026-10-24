import { toCents } from './money.utils';

describe('toCents', () => {
  it('should remove floating point noise', () => {
    // assert & verify
    expect(toCents(0.1 + 0.2)).toBe(0.3);
    expect(toCents(4820.149999999)).toBe(4820.15);
  });
});
