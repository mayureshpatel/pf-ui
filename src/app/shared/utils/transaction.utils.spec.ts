import { describe, it, expect, vi } from 'vitest';
import { fromLocalDateString, toLocalDateString } from './transaction.utils';

describe('toLocalDateString', () => {
  it("should read the Date's local getters directly, not derive from toISOString's UTC value (PF-199)", () => {
    // Arrange -- a moment where the local calendar date (March 15) differs from the UTC one
    // (March 14). toISOString() always reflects UTC and is deliberately left un-mocked here;
    // getFullYear/getMonth/getDate are mocked to simulate what a real positive-UTC-offset
    // browser's local getters would report for this same instant.
    const date = new Date(Date.UTC(2026, 2, 14, 15, 30, 0));
    vi.spyOn(date, 'getFullYear').mockReturnValue(2026);
    vi.spyOn(date, 'getMonth').mockReturnValue(2); // March, 0-indexed
    vi.spyOn(date, 'getDate').mockReturnValue(15);

    // Act
    const result = toLocalDateString(date);

    // Assert -- must match the local getters (2026-03-15), not toISOString's UTC date (2026-03-14)
    expect(result).toBe('2026-03-15');
  });

  it('should pad single-digit months and days with a leading zero', () => {
    // Arrange
    const date = new Date(2026, 0, 5); // Jan 5, 2026

    // Act & Assert
    expect(toLocalDateString(date)).toBe('2026-01-05');
  });
});

describe('fromLocalDateString', () => {
  it(
    "bug regression: should parse a 'yyyy-MM-dd' string to local midnight, not UTC midnight " +
      '(reports.component.ts and date-range-filter.component.ts both round-tripped a ' +
      'toLocalDateString() result through the plain new Date(string) constructor, which always ' +
      'parses a bare date string as UTC midnight regardless of local timezone -- reformatting ' +
      'that Date through toLocalDateString() again then rolled the date back by a full day for ' +
      'any user in a negative UTC offset (the Americas), silently excluding "today"\'s own ' +
      'transactions from every reports date-range preset for its entire duration in production, ' +
      'confirmed live)',
    () => {
      // act
      const result = fromLocalDateString('2026-09-11');

      // assert & verify -- the local getters (what toLocalDateString would read back) must match
      // the input exactly, which the 3-argument Date constructor guarantees but new Date(string)
      // does not for any negative UTC offset.
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(8); // September, 0-indexed
      expect(result.getDate()).toBe(11);
    },
  );

  it('should round-trip through toLocalDateString unchanged', () => {
    // arrange
    const original = '2026-01-05';

    // act
    const result = toLocalDateString(fromLocalDateString(original));

    // assert & verify
    expect(result).toBe(original);
  });
});
