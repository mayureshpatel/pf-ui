import { DrillStep, ExploreState } from '../models/reports.model';
import {
  DEFAULT_STATE,
  defaultState,
  fromQueryParams,
  toApiParams,
  toQueryParams,
} from './explore-state';

const TODAY = new Date(2026, 9, 25);

const CATEGORY_STEP: DrillStep = {
  groupBy: 'CATEGORY',
  filterKey: 'categoryId',
  label: 'Food',
  value: 5,
};
const PERIOD_STEP: DrillStep = {
  groupBy: 'WEEK',
  filterKey: 'period',
  label: 'Week of Mar 9',
  value: '2026-03-10..2026-03-16',
};

const FULL: ExploreState = {
  measure: 'COUNT',
  side: 'INCOME',
  groupBy: 'MERCHANT',
  startDate: '2026-03-01',
  endDate: '2026-03-31',
  rangeLabel: 'Last month',
  compare: 'PREVIOUS_PERIOD',
  sort: 'change',
  filters: {
    accountIds: [1, 2],
    categoryId: 5,
    categoryName: 'Food',
    uncategorized: false,
    merchantId: 9,
    merchantName: 'Whole Foods',
    noMerchant: false,
    tagId: 3,
    noTag: false,
    minAmount: 5,
    maxAmount: 500,
  },
  drill: [CATEGORY_STEP, PERIOD_STEP],
  leaf: true,
  period: { start: '2026-03-10', end: '2026-03-16', label: 'Week of Mar 9' },
};

describe('explore state', () => {
  describe('defaultState', () => {
    it('should open on spending by category for this year', () => {
      // act
      const state = defaultState(TODAY);

      // assert & verify
      expect(state).toEqual({
        measure: 'SPENDING',
        side: 'SPENDING',
        groupBy: 'CATEGORY',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        rangeLabel: 'This year',
        compare: 'NONE',
        sort: 'value',
        filters: { accountIds: [] },
        drill: [],
        leaf: false,
        period: null,
      });
      expect(DEFAULT_STATE.measure).toBe('SPENDING');
    });
  });

  describe('toQueryParams / fromQueryParams', () => {
    it('should round trip every field', () => {
      // act
      const { state, note } = fromQueryParams(toQueryParams(FULL), TODAY);

      // assert & verify
      expect(note).toBeNull();
      expect(state.measure).toBe('COUNT');
      expect(state.side).toBe('INCOME');
      expect(state.groupBy).toBe('MERCHANT');
      expect(state.startDate).toBe('2026-03-01');
      expect(state.endDate).toBe('2026-03-31');
      expect(state.rangeLabel).toBe('Last month');
      expect(state.compare).toBe('PREVIOUS_PERIOD');
      expect(state.sort).toBe('change');
      expect(state.leaf).toBe(true);
      expect(state.period).toEqual(FULL.period);
      expect(state.drill).toEqual([CATEGORY_STEP, PERIOD_STEP]);
      expect(state.filters.accountIds).toEqual([1, 2]);
      expect(state.filters.categoryId).toBe(5);
      expect(state.filters.categoryName).toBe('Food');
      expect(state.filters.merchantId).toBe(9);
      expect(state.filters.merchantName).toBe('Whole Foods');
      expect(state.filters.tagId).toBe(3);
      expect(state.filters.minAmount).toBe(5);
      expect(state.filters.maxAmount).toBe(500);
    });

    it('should round trip the "none" filters and a label containing a pipe', () => {
      // arrange
      const none: ExploreState = {
        ...defaultState(TODAY),
        filters: { accountIds: [], uncategorized: true, noMerchant: true, noTag: true },
        drill: [
          {
            groupBy: 'MERCHANT',
            filterKey: 'noMerchant',
            label: 'No merchant | misc',
            value: true,
          },
        ],
      };

      // act
      const { state } = fromQueryParams(toQueryParams(none), TODAY);

      // assert & verify
      expect(state.filters.uncategorized).toBe(true);
      expect(state.filters.noMerchant).toBe(true);
      expect(state.filters.noTag).toBe(true);
      expect(state.drill).toEqual(none.drill);
    });

    it('should leave defaults out of the URL', () => {
      // act
      const params = toQueryParams(defaultState(TODAY));

      // assert & verify
      expect(Object.keys(params).sort()).toEqual(
        ['endDate', 'groupBy', 'measure', 'range', 'startDate'].sort(),
      );
    });

    it('should fall back to the default for an invalid measure and grouping pair, with a note', () => {
      // act
      const { state, note } = fromQueryParams(
        { measure: 'NET', groupBy: 'CATEGORY', startDate: '2026-03-01', endDate: '2026-03-31' },
        TODAY,
      );

      // assert & verify
      expect(state.measure).toBe('SPENDING');
      expect(state.groupBy).toBe('CATEGORY');
      expect(state.startDate).toBe('2026-03-01');
      expect(note).not.toBeNull();
    });

    it('should ignore an unknown grouping and say so', () => {
      // act
      const { state, note } = fromQueryParams({ groupBy: 'BOGUS', compare: 'LATER' }, TODAY);

      // assert & verify
      expect(state.groupBy).toBe('CATEGORY');
      expect(state.compare).toBe('NONE');
      expect(note).not.toBeNull();
    });

    it('should default missing dates to this year without a note', () => {
      // act
      const { state, note } = fromQueryParams({ measure: 'INCOME' }, TODAY);

      // assert & verify
      expect(state.startDate).toBe('2026-01-01');
      expect(state.endDate).toBe('2026-12-31');
      expect(state.rangeLabel).toBe('This year');
      expect(note).toBeNull();
    });

    it('should fall back to this year for malformed or reversed dates, with a note', () => {
      // act
      const malformed = fromQueryParams({ startDate: 'nope', endDate: '2026-03-01' }, TODAY);
      const reversed = fromQueryParams({ startDate: '2026-05-01', endDate: '2026-03-01' }, TODAY);

      // assert & verify
      expect(malformed.state.startDate).toBe('2026-01-01');
      expect(malformed.note).not.toBeNull();
      expect(reversed.state.endDate).toBe('2026-12-31');
      expect(reversed.note).not.toBeNull();
    });

    it('should drop a malformed drill path and non-numeric ids with a note', () => {
      // act
      const { state, note } = fromQueryParams(
        { drill: ['CATEGORY|categoryId'], categoryId: 'abc', accountIds: '1,x' },
        TODAY,
      );

      // assert & verify
      expect(state.drill).toEqual([]);
      expect(state.filters.categoryId).toBeUndefined();
      expect(state.filters.accountIds).toEqual([1]);
      expect(note).not.toBeNull();
    });

    it('should read a single drill value as a one-step path', () => {
      // act
      const { state } = fromQueryParams({ drill: 'CATEGORY|categoryId|5|Food' }, TODAY);

      // assert & verify
      expect(state.drill).toEqual([CATEGORY_STEP]);
    });
  });

  describe('toApiParams', () => {
    it('should send the measure, grouping, range, comparison and filters by their API names', () => {
      // act
      const params = toApiParams({ ...FULL, period: null });

      // assert & verify
      expect(params).toEqual({
        measure: 'COUNT',
        side: 'INCOME',
        groupBy: 'MERCHANT',
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        compare: 'PREVIOUS_PERIOD',
        accountIds: '1,2',
        categoryId: '5',
        merchantId: '9',
        tagId: '3',
        minAmount: '5',
        maxAmount: '500',
      });
    });

    it('should use the period instead of the range when one is set', () => {
      // act
      const params = toApiParams(FULL);

      // assert & verify
      expect(params['startDate']).toBe('2026-03-10');
      expect(params['endDate']).toBe('2026-03-16');
    });

    it('should send only what is set', () => {
      // act
      const params = toApiParams({
        ...defaultState(TODAY),
        filters: { accountIds: [], uncategorized: true, noTag: true },
      });

      // assert & verify
      expect(params).toEqual({
        measure: 'SPENDING',
        side: 'SPENDING',
        groupBy: 'CATEGORY',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        compare: 'NONE',
        uncategorized: 'true',
        noTag: 'true',
      });
    });
  });
});
