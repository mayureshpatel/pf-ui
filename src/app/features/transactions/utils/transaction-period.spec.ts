import { TransactionFilter } from '@models/transaction.model';
import {
  describeEmptyPeriod,
  detectPreset,
  hasAnyFilter,
  hasOnlyPeriodFilter,
  presetRange,
} from './transaction-period';

const TODAY = new Date(2026, 9, 17); // Oct 17, 2026, local time

describe('transaction-period', () => {
  describe('presetRange', () => {
    it('should cover the whole current month for THIS_MONTH', () => {
      // assert & verify
      expect(presetRange('THIS_MONTH', TODAY)).toEqual({
        startDate: new Date(2026, 9, 1),
        endDate: new Date(2026, 9, 31),
      });
    });

    it('should cover the whole previous month for LAST_MONTH, wrapping January', () => {
      // assert & verify
      expect(presetRange('LAST_MONTH', TODAY)).toEqual({
        startDate: new Date(2026, 8, 1),
        endDate: new Date(2026, 8, 30),
      });
      expect(presetRange('LAST_MONTH', new Date(2026, 0, 10))).toEqual({
        startDate: new Date(2025, 11, 1),
        endDate: new Date(2025, 11, 31),
      });
    });

    it('should cover the whole current year for THIS_YEAR and nothing for ALL_TIME', () => {
      // assert & verify
      expect(presetRange('THIS_YEAR', TODAY)).toEqual({
        startDate: new Date(2026, 0, 1),
        endDate: new Date(2026, 11, 31),
      });
      expect(presetRange('ALL_TIME', TODAY)).toEqual({});
    });
  });

  describe('detectPreset', () => {
    it('should recognise each preset from its own range', () => {
      // assert & verify
      expect(detectPreset(presetRange('THIS_MONTH', TODAY), TODAY)).toBe('THIS_MONTH');
      expect(detectPreset(presetRange('LAST_MONTH', TODAY), TODAY)).toBe('LAST_MONTH');
      expect(detectPreset(presetRange('THIS_YEAR', TODAY), TODAY)).toBe('THIS_YEAR');
      expect(detectPreset({}, TODAY)).toBe('ALL_TIME');
    });

    it('should call any other range CUSTOM, including a half-open one', () => {
      // assert & verify
      expect(
        detectPreset({ startDate: new Date(2026, 5, 1), endDate: new Date(2026, 5, 9) }, TODAY),
      ).toBe('CUSTOM');
      expect(detectPreset({ startDate: new Date(2026, 9, 1) }, TODAY)).toBe('CUSTOM');
    });

    it('should compare calendar days, not exact instants', () => {
      // act -- same calendar day but a time of day set, as a date picker can produce
      const result = detectPreset(
        { startDate: new Date(2026, 9, 1, 14, 30), endDate: new Date(2026, 9, 31, 9, 0) },
        TODAY,
      );

      // assert & verify
      expect(result).toBe('THIS_MONTH');
    });
  });

  describe('hasAnyFilter', () => {
    it('should be false for an empty filter and true when any field is set', () => {
      // assert & verify
      expect(hasAnyFilter({})).toBe(false);
      expect(hasAnyFilter({ categoryName: 'null' })).toBe(true);
      expect(hasAnyFilter({ minAmount: 0 } as TransactionFilter)).toBe(true);
      expect(hasAnyFilter({ description: undefined })).toBe(false);
    });
  });

  describe('null filter values', () => {
    it('should not count a null (an emptied input) as an applied filter', () => {
      // assert & verify
      expect(hasAnyFilter({ minAmount: null as unknown as undefined })).toBe(false);
    });
  });

  describe('hasOnlyPeriodFilter (PF-867)', () => {
    it('should be true when only dates are set', () => {
      // assert & verify
      expect(hasOnlyPeriodFilter({ startDate: TODAY })).toBe(true);
      expect(hasOnlyPeriodFilter({ startDate: TODAY, endDate: TODAY })).toBe(true);
    });

    it('should be false when no dates are set, or any other filter is set with them', () => {
      // assert & verify
      expect(hasOnlyPeriodFilter({})).toBe(false);
      expect(hasOnlyPeriodFilter({ description: 'x' })).toBe(false);
      expect(hasOnlyPeriodFilter({ startDate: TODAY, categoryName: 'Groceries' })).toBe(false);
    });

    it('should ignore cleared (null or undefined) fields next to the dates', () => {
      // assert & verify -- a cleared number input reports null
      expect(
        hasOnlyPeriodFilter({
          startDate: TODAY,
          minAmount: null as unknown as number,
          description: undefined,
        }),
      ).toBe(true);
    });
  });

  describe('describeEmptyPeriod (PF-867)', () => {
    it('should name the month for THIS_MONTH', () => {
      // assert & verify
      expect(describeEmptyPeriod(presetRange('THIS_MONTH', TODAY), TODAY)).toBe(
        'No transactions in October yet',
      );
    });

    it('should name the month for LAST_MONTH', () => {
      // assert & verify
      expect(describeEmptyPeriod(presetRange('LAST_MONTH', TODAY), TODAY)).toBe(
        'No transactions in September',
      );
    });

    it('should name the year for THIS_YEAR', () => {
      // assert & verify
      expect(describeEmptyPeriod(presetRange('THIS_YEAR', TODAY), TODAY)).toBe(
        'No transactions in 2026 yet',
      );
    });

    it('should fall back to the date range for a custom range', () => {
      // assert & verify
      expect(
        describeEmptyPeriod(
          { startDate: new Date(2026, 2, 3), endDate: new Date(2026, 2, 9) },
          TODAY,
        ),
      ).toBe('No transactions in this date range');
    });
  });
});
