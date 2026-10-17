import {
  describePeriod,
  formatRange,
  monthRange,
  previousMonthRange,
  previousRange,
} from './period-label';

describe('period-label', () => {
  describe('previousRange', () => {
    it('should return the same number of days immediately before the start', () => {
      // act
      const result = previousRange({ start: '2026-10-01', end: '2026-10-13' });

      // assert & verify -- 13 days, ending the day before Oct 1
      expect(result).toEqual({ start: '2026-09-18', end: '2026-09-30' });
    });

    it('should treat a full 30-day month as a 30-day window, not the prior calendar month', () => {
      // act
      const result = previousRange({ start: '2026-09-01', end: '2026-09-30' });

      // assert & verify
      expect(result).toEqual({ start: '2026-08-02', end: '2026-08-31' });
    });

    it('should cross a year boundary', () => {
      // act
      const result = previousRange({ start: '2026-01-01', end: '2026-01-10' });

      // assert & verify
      expect(result).toEqual({ start: '2025-12-22', end: '2025-12-31' });
    });
  });

  describe('monthRange and previousMonthRange', () => {
    it('should cover a whole calendar month, including a leap February', () => {
      // assert & verify
      expect(monthRange(2, 2028)).toEqual({ start: '2028-02-01', end: '2028-02-29' });
      expect(monthRange(10, 2026)).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    });

    it('should wrap January back to December of the prior year', () => {
      // assert & verify
      expect(previousMonthRange(1, 2026)).toEqual({ start: '2025-12-01', end: '2025-12-31' });
    });

    it('should step back one month otherwise', () => {
      // assert & verify
      expect(previousMonthRange(3, 2026)).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    });
  });

  describe('formatRange', () => {
    it('should print a full calendar month as month and year', () => {
      // assert & verify
      expect(formatRange({ start: '2026-09-01', end: '2026-09-30' })).toBe('September 2026');
    });

    it('should print a partial range within one year with the year once', () => {
      // assert & verify
      expect(formatRange({ start: '2026-10-01', end: '2026-10-13' })).toBe('Oct 1 to Oct 13, 2026');
    });

    it('should print both years when a range spans two years', () => {
      // assert & verify
      expect(formatRange({ start: '2025-12-01', end: '2026-01-13' })).toBe(
        'Dec 1, 2025 to Jan 13, 2026',
      );
    });
  });

  describe('describePeriod', () => {
    it('should join the current and previous labels in plain words', () => {
      // act
      const text = describePeriod(monthRange(3, 2026), previousMonthRange(3, 2026));

      // assert & verify
      expect(text).toBe('March 2026 compared with February 2026');
    });
  });
});
