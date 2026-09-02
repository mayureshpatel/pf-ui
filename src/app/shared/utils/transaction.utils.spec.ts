import {describe, it, expect, vi} from 'vitest';
import {toLocalDateString} from './transaction.utils';

describe('toLocalDateString', () => {
  it('should read the Date\'s local getters directly, not derive from toISOString\'s UTC value (PF-199)', () => {
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
