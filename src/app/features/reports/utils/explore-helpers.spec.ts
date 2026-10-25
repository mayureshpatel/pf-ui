import {
  ExploreFilters,
  ExploreRow,
  ExploreState,
  GroupBy,
  Measure,
} from '../models/reports.model';
import { defaultState } from './explore-state';
import {
  applyStartView,
  reconcileDrill,
  biggestRow,
  rangeText,
  rootCrumb,
  selectPeriod,
  bucketLabel,
  formatMeasure,
  granularityOf,
  isAdditive,
  changeText,
  drill,
  filterOnly,
  isAllowed,
  isDrillable,
  isTransactionsLinkable,
  nextGrouping,
  openTransactions,
  polarity,
  rangePresets,
  startViews,
  stepBack,
  toTransactionsQuery,
  topWithOther,
} from './explore-helpers';

const TODAY = new Date(2026, 9, 25);
const row = (
  key: string | null,
  label: string,
  value: number | null = 10,
  comparisonValue: number | null = null,
  count = 1,
): ExploreRow => ({ key, label, value, comparisonValue, count });
const base = (): ExploreState => defaultState(TODAY);

describe('explore helpers', () => {
  describe('isAllowed', () => {
    const ALL: GroupBy[] = [
      'CATEGORY',
      'SUBCATEGORY',
      'MERCHANT',
      'ACCOUNT',
      'TAG',
      'MONTH',
      'WEEK',
      'DAY_OF_WEEK',
      'DAY',
    ];
    const TIME: GroupBy[] = ['MONTH', 'WEEK', 'DAY'];

    it('should allow every grouping for the measures that work for any group', () => {
      (['SPENDING', 'INCOME', 'COUNT', 'AVERAGE'] as Measure[]).forEach((measure) =>
        ALL.forEach((groupBy) => expect(isAllowed(measure, groupBy).ok).toBe(true)),
      );
    });

    it('should allow net and savings rate over time only, and say why otherwise', () => {
      (['NET', 'SAVINGS_RATE'] as Measure[]).forEach((measure) =>
        ALL.forEach((groupBy) => {
          // act
          const result = isAllowed(measure, groupBy);

          // assert & verify
          expect(result.ok).toBe(TIME.includes(groupBy));
          if (!result.ok) {
            expect(result.reason).toContain('only makes sense over time');
          }
        }),
      );
    });

    it('should phrase the reason for each measure', () => {
      // assert & verify
      expect(isAllowed('NET', 'CATEGORY').reason).toBe(
        'Net is income minus spending, so it only makes sense over time.',
      );
      expect(isAllowed('SAVINGS_RATE', 'TAG').reason).toBe(
        'Savings rate compares income with spending, so it only makes sense over time.',
      );
    });
  });

  describe('nextGrouping', () => {
    it('should follow the category chain from a category start', () => {
      // assert & verify
      expect(nextGrouping('CATEGORY')).toBe('SUBCATEGORY');
      expect(nextGrouping('SUBCATEGORY')).toBe('MERCHANT');
      expect(
        nextGrouping('MERCHANT', [
          { groupBy: 'CATEGORY', filterKey: 'categoryId', label: 'F', value: 1 },
        ]),
      ).toBe('TRANSACTIONS');
    });

    it('should go to category and then transactions from every other start', () => {
      (['MERCHANT', 'ACCOUNT', 'TAG', 'MONTH', 'WEEK', 'DAY_OF_WEEK', 'DAY'] as GroupBy[]).forEach(
        (groupBy) => {
          // assert & verify
          expect(nextGrouping(groupBy)).toBe('CATEGORY');
        },
      );
      expect(
        nextGrouping('CATEGORY', [
          { groupBy: 'ACCOUNT', filterKey: 'accountIds', label: 'A', value: 1 },
        ]),
      ).toBe('TRANSACTIONS');
      expect(
        nextGrouping('CATEGORY', [
          { groupBy: 'MONTH', filterKey: 'period', label: 'M', value: 'a..b' },
        ]),
      ).toBe('TRANSACTIONS');
    });

    it('should not offer the merchant step again once a merchant is chosen', () => {
      // assert & verify
      expect(
        nextGrouping('SUBCATEGORY', [
          { groupBy: 'MERCHANT', filterKey: 'merchantId', label: 'M', value: 1 },
        ]),
      ).toBe('TRANSACTIONS');
    });
  });

  describe('drill', () => {
    it('should add the category chip and move to subcategories', () => {
      // act
      const next = drill(base(), row('5', 'Food'));

      // assert & verify
      expect(next.filters.categoryId).toBe(5);
      expect(next.filters.categoryName).toBe('Food');
      expect(next.groupBy).toBe('SUBCATEGORY');
      expect(next.leaf).toBe(false);
      expect(next.drill).toEqual([
        { groupBy: 'CATEGORY', filterKey: 'categoryId', label: 'Food', value: 5 },
      ]);
    });

    it('should replace the category with the subcategory and then reach merchants and transactions', () => {
      // act
      const food = drill(base(), row('5', 'Food'));
      const groceries = drill(food, row('8', 'Groceries'));
      const merchant = drill(groceries, row('9', 'Whole Foods'));

      // assert & verify
      expect(groceries.filters.categoryId).toBe(8);
      expect(groceries.filters.categoryName).toBe('Groceries');
      expect(groceries.groupBy).toBe('MERCHANT');
      expect(merchant.filters.merchantId).toBe(9);
      expect(merchant.filters.merchantName).toBe('Whole Foods');
      expect(merchant.leaf).toBe(true);
      expect(merchant.groupBy).toBe('MERCHANT');
      expect(merchant.drill.map((step) => step.label)).toEqual([
        'Food',
        'Groceries',
        'Whole Foods',
      ]);
    });

    it('should drill into the "none" rows', () => {
      // act
      const uncategorized = drill(base(), row(null, 'Uncategorized'));
      const noMerchant = drill({ ...base(), groupBy: 'MERCHANT' }, row(null, 'No merchant'));
      const noTag = drill({ ...base(), groupBy: 'TAG' }, row(null, 'No tag'));

      // assert & verify
      expect(uncategorized.filters.uncategorized).toBe(true);
      expect(noMerchant.filters.noMerchant).toBe(true);
      expect(noMerchant.groupBy).toBe('CATEGORY');
      expect(noTag.filters.noTag).toBe(true);
    });

    it('should filter to one account or one tag', () => {
      // act
      const account = drill({ ...base(), groupBy: 'ACCOUNT' }, row('3', 'Checking'));
      const tag = drill({ ...base(), groupBy: 'TAG' }, row('4', 'Trip'));

      // assert & verify
      expect(account.filters.accountIds).toEqual([3]);
      expect(account.groupBy).toBe('CATEGORY');
      expect(tag.filters.tagId).toBe(4);
    });

    it('should turn a month, week or day into a period within the range', () => {
      // act
      const month = drill({ ...base(), groupBy: 'MONTH' }, row('2026-03-01', 'Mar 2026'));
      const week = drill({ ...base(), groupBy: 'WEEK' }, row('2026-03-09', 'Week of Mar 9, 2026'));
      const day = drill({ ...base(), groupBy: 'DAY' }, row('2026-03-12', 'Mar 12, 2026'));
      const clipped = drill(
        { ...base(), groupBy: 'MONTH', startDate: '2026-03-15' },
        row('2026-03-01', 'Mar 2026'),
      );

      // assert & verify
      expect(month.period).toEqual({ start: '2026-03-01', end: '2026-03-31', label: 'Mar 2026' });
      expect(month.groupBy).toBe('CATEGORY');
      expect(week.period).toEqual({
        start: '2026-03-09',
        end: '2026-03-15',
        label: 'Week of Mar 9, 2026',
      });
      expect(day.period).toEqual({ start: '2026-03-12', end: '2026-03-12', label: 'Mar 12, 2026' });
      expect(clipped.period?.start).toBe('2026-03-15');
    });

    it('should leave the state alone for a day of the week, which the API cannot filter on', () => {
      // arrange
      const state: ExploreState = { ...base(), groupBy: 'DAY_OF_WEEK' };

      // act & assert & verify
      expect(isDrillable('DAY_OF_WEEK')).toBe(false);
      expect(isDrillable('MONTH')).toBe(true);
      expect(drill(state, row('3', 'Wednesday'))).toBe(state);
    });
  });

  describe('filterOnly and openTransactions', () => {
    it('should filter to the row and keep the grouping', () => {
      // act
      const next = filterOnly(base(), row('5', 'Food'));

      // assert & verify
      expect(next.filters.categoryId).toBe(5);
      expect(next.groupBy).toBe('CATEGORY');
      expect(next.leaf).toBe(false);
      expect(next.drill).toHaveLength(1);
    });

    it('should filter to the row and show its transactions', () => {
      // act
      const next = openTransactions(base(), row('5', 'Food'));

      // assert & verify
      expect(next.filters.categoryId).toBe(5);
      expect(next.leaf).toBe(true);
      expect(next.groupBy).toBe('CATEGORY');
    });
  });

  describe('stepBack', () => {
    const deep = (): ExploreState => {
      const start: ExploreState = {
        ...base(),
        filters: { accountIds: [1], minAmount: 5 },
      };
      return drill(
        drill(drill(start, row('5', 'Food')), row('8', 'Groceries')),
        row('9', 'Whole Foods'),
      );
    };

    it('should remove the later steps, restore the earlier category and keep the other filters', () => {
      // act
      const next = stepBack(deep(), 1);

      // assert & verify
      expect(next.drill.map((step) => step.label)).toEqual(['Food']);
      expect(next.filters.categoryId).toBe(5);
      expect(next.filters.categoryName).toBe('Food');
      expect(next.filters.merchantId).toBeUndefined();
      expect(next.filters.accountIds).toEqual([1]);
      expect(next.filters.minAmount).toBe(5);
      expect(next.groupBy).toBe('SUBCATEGORY');
      expect(next.leaf).toBe(false);
    });

    it('should go all the way back to the start', () => {
      // act
      const next = stepBack(deep(), 0);

      // assert & verify
      expect(next.drill).toEqual([]);
      expect(next.filters.categoryId).toBeUndefined();
      expect(next.filters.categoryName).toBeUndefined();
      expect(next.groupBy).toBe('CATEGORY');
      expect(next.filters.accountIds).toEqual([1]);
    });

    it('should restore or clear the period', () => {
      // arrange
      const inMarch = drill({ ...base(), groupBy: 'MONTH' }, row('2026-03-01', 'Mar 2026'));
      const inWeek = drill(
        { ...inMarch, groupBy: 'WEEK' },
        row('2026-03-09', 'Week of Mar 9, 2026'),
      );

      // act
      const backToMarch = stepBack(inWeek, 1);
      const cleared = stepBack(inWeek, 0);

      // assert & verify
      expect(backToMarch.period).toEqual({
        start: '2026-03-01',
        end: '2026-03-31',
        label: 'Mar 2026',
      });
      expect(cleared.period).toBeNull();
    });

    it('should do nothing when the index is past the last step', () => {
      // arrange
      const state = deep();

      // act & assert & verify
      expect(stepBack(state, 3)).toBe(state);
    });
  });

  describe('polarity and changeText', () => {
    it('should judge spending up as bad, income and net up as good, count and average as neutral', () => {
      // assert & verify
      expect(polarity('SPENDING')).toBe('up-bad');
      expect(polarity('INCOME')).toBe('up-good');
      expect(polarity('NET')).toBe('up-good');
      expect(polarity('SAVINGS_RATE')).toBe('up-good');
      expect(polarity('COUNT')).toBe('neutral');
      expect(polarity('AVERAGE')).toBe('neutral');
    });

    it('should put the arrow and the words in the text and colour by polarity', () => {
      // assert & verify
      expect(changeText(118.7, 100, 'SPENDING')).toEqual({ text: '▲ up 18.7%', tone: 'bad' });
      expect(changeText(88, 100, 'SPENDING')).toEqual({ text: '▼ down 12%', tone: 'good' });
      expect(changeText(118.7, 100, 'INCOME')).toEqual({ text: '▲ up 18.7%', tone: 'good' });
      expect(changeText(88, 100, 'INCOME')).toEqual({ text: '▼ down 12%', tone: 'bad' });
      expect(changeText(110, 100, 'COUNT')).toEqual({ text: '▲ up 10%', tone: 'neutral' });
      expect(changeText(150, 100, 'NET')).toEqual({ text: '▲ up 50%', tone: 'good' });
    });

    it('should report no change, and nothing when there is nothing to compare', () => {
      // assert & verify
      expect(changeText(100, 100, 'SPENDING')).toEqual({ text: 'no change', tone: 'neutral' });
      expect(changeText(0, 0, 'SPENDING')).toEqual({ text: 'no change', tone: 'neutral' });
      expect(changeText(100, null, 'SPENDING')).toEqual({ text: '', tone: 'neutral' });
      expect(changeText(null, 100, 'SAVINGS_RATE')).toEqual({ text: '', tone: 'neutral' });
    });

    it('should call a value with a zero comparison new rather than dividing by zero', () => {
      // assert & verify
      expect(changeText(50, 0, 'SPENDING')).toEqual({ text: 'new', tone: 'neutral' });
    });

    it('should show the savings rate change in points', () => {
      // assert & verify
      expect(changeText(24, 20, 'SAVINGS_RATE')).toEqual({ text: '▲ up 4 pts', tone: 'good' });
      expect(changeText(18.5, 20, 'SAVINGS_RATE')).toEqual({ text: '▼ down 1.5 pts', tone: 'bad' });
    });
  });

  describe('topWithOther', () => {
    const rows = (count: number): ExploreRow[] =>
      Array.from({ length: count }, (_, i) => row(String(i + 1), `Row ${i + 1}`, 100 - i, 50, 2));

    it('should keep everything when there are ten rows or fewer', () => {
      // act
      const result = topWithOther(rows(10), 10, false);

      // assert & verify
      expect(result.rows).toHaveLength(10);
      expect(result.other).toBeNull();
      expect(result.hiddenCount).toBe(0);
    });

    it('should fold the rest into one Other row with the summed value, comparison and count', () => {
      // act
      const result = topWithOther(rows(13), 10, false);

      // assert & verify
      expect(result.rows).toHaveLength(10);
      expect(result.hiddenCount).toBe(3);
      expect(result.other).toEqual({
        key: '__other__',
        label: 'Other (3 more)',
        value: 90 + 89 + 88,
        comparisonValue: 150,
        count: 6,
      });
    });

    it('should leave the summed value empty for a measure that cannot be added up', () => {
      // act
      const result = topWithOther(rows(12), 10, false, false);

      // assert & verify
      expect(result.other?.value).toBeNull();
      expect(result.other?.comparisonValue).toBeNull();
    });

    it('should always keep the none rows visible and put Other last', () => {
      // arrange
      const list = [...rows(12), row(null, 'No merchant', 1)];

      // act
      const result = topWithOther(list, 10, false);

      // assert & verify
      expect(result.rows.map((r) => r.label)).toContain('No merchant');
      expect(result.rows).toHaveLength(11);
      expect(result.other?.label).toBe('Other (2 more)');
    });

    it('should show every row when Other is expanded', () => {
      // act
      const result = topWithOther(rows(13), 10, true);

      // assert & verify
      expect(result.rows).toHaveLength(13);
      expect(result.other).toBeNull();
      expect(result.hiddenCount).toBe(3);
    });
  });

  describe('isTransactionsLinkable', () => {
    const filters = (extra: Partial<ExploreFilters>): ExploreFilters => ({
      accountIds: [],
      ...extra,
    });

    it('should explain why several accounts cannot be opened', () => {
      // act
      const result = isTransactionsLinkable(filters({ accountIds: [1, 2] }));

      // assert & verify
      expect(result).toEqual({
        ok: false,
        reason: "The Transactions page can't show several accounts at once.",
      });
    });

    it('should allow one account and a category', () => {
      // assert & verify
      expect(
        isTransactionsLinkable(filters({ accountIds: [1], categoryId: 5, categoryName: 'Food' }))
          .ok,
      ).toBe(true);
      expect(isTransactionsLinkable(filters({})).ok).toBe(true);
    });

    it('should refuse the none filters and the measures that mix income with spending', () => {
      // assert & verify
      expect(isTransactionsLinkable(filters({ uncategorized: true })).reason).toContain(
        'uncategorized',
      );
      expect(isTransactionsLinkable(filters({ noMerchant: true })).reason).toContain(
        'without a merchant',
      );
      expect(isTransactionsLinkable(filters({ noTag: true })).reason).toContain('without a tag');
      expect(isTransactionsLinkable(filters({}), 'NET').reason).toContain(
        'income and spending together',
      );
    });
  });

  describe('toTransactionsQuery', () => {
    it('should map the state onto the Transactions page parameters', () => {
      // arrange
      const state: ExploreState = {
        ...base(),
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        filters: {
          accountIds: [1],
          categoryId: 5,
          categoryName: 'Food',
          merchantId: 9,
          merchantName: 'Whole Foods',
          tagId: 3,
          minAmount: 5,
          maxAmount: 500,
        },
      };

      // act
      const query = toTransactionsQuery(state);

      // assert & verify
      expect(query).toEqual({
        accountId: '1',
        type: 'EXPENSE',
        merchant: 'Whole Foods',
        categoryName: 'Food',
        tagId: '3',
        minAmount: '5',
        maxAmount: '500',
        startDate: '2026-03-01',
        endDate: '2026-03-31',
      });
    });

    it('should use the period, the income type for income, and null when it cannot be linked', () => {
      // arrange
      const withPeriod: ExploreState = {
        ...base(),
        measure: 'INCOME',
        period: { start: '2026-03-10', end: '2026-03-16', label: 'Week' },
      };

      // act & assert & verify
      expect(toTransactionsQuery(withPeriod)).toEqual({
        type: 'INCOME',
        startDate: '2026-03-10',
        endDate: '2026-03-16',
      });
      expect(toTransactionsQuery({ ...base(), filters: { accountIds: [1, 2] } })).toBeNull();
    });

    it('should follow the side for count and average', () => {
      // assert & verify
      expect(toTransactionsQuery({ ...base(), measure: 'COUNT', side: 'INCOME' })?.['type']).toBe(
        'INCOME',
      );
    });
  });

  describe('start views', () => {
    it('should offer the four shortcuts', () => {
      // assert & verify
      expect(startViews.map((view) => view.label)).toEqual([
        'Top merchants',
        'Monthly cash flow',
        'Biggest movers',
        'Uncategorized',
      ]);
    });

    it('should set the controls of each shortcut and clear the drill', () => {
      // arrange
      const drilled = drill(base(), row('5', 'Food'));
      const view = (key: string) => startViews.find((v) => v.key === key)!;

      // act
      const merchants = applyStartView(drilled, view('top-merchants'));
      const cashFlow = applyStartView(base(), view('monthly-cash-flow'));
      const movers = applyStartView(base(), view('biggest-movers'));
      const uncategorized = applyStartView(base(), view('uncategorized'));

      // assert & verify
      expect(merchants.measure).toBe('SPENDING');
      expect(merchants.groupBy).toBe('MERCHANT');
      expect(merchants.drill).toEqual([]);
      expect(merchants.filters.categoryId).toBeUndefined();
      expect(cashFlow.measure).toBe('NET');
      expect(cashFlow.groupBy).toBe('MONTH');
      expect(cashFlow.compare).toBe('PREVIOUS_PERIOD');
      expect(movers.compare).toBe('SAME_DAYS_LAST_YEAR');
      expect(movers.sort).toBe('change');
      expect(uncategorized.groupBy).toBe('MERCHANT');
      expect(uncategorized.filters.uncategorized).toBe(true);
    });
  });

  describe('rangePresets', () => {
    it('should list the presets with their real dates', () => {
      // act
      const presets = rangePresets(TODAY);

      // assert & verify
      expect(presets.map((p) => [p.label, p.startDate, p.endDate])).toEqual([
        ['This month', '2026-10-01', '2026-10-31'],
        ['Last month', '2026-09-01', '2026-09-30'],
        ['This quarter', '2026-10-01', '2026-12-31'],
        ['This year', '2026-01-01', '2026-12-31'],
        ['Last 12 months', '2025-10-26', '2026-10-25'],
        ['All time', '2000-01-01', '2026-10-25'],
      ]);
    });
  });

  describe('formatMeasure', () => {
    it('should format dollars, a savings rate, a count and an empty value', () => {
      // assert & verify
      expect(formatMeasure('SPENDING', 1234.5)).toBe('$1,234.50');
      expect(formatMeasure('NET', -50)).toBe('-$50.00');
      expect(formatMeasure('SAVINGS_RATE', 24.55)).toBe('24.6%');
      expect(formatMeasure('SAVINGS_RATE', -12)).toBe('-12%');
      expect(formatMeasure('COUNT', 1204)).toBe('1,204');
      expect(formatMeasure('AVERAGE', null)).toBe('—');
    });

    it('should say which measures can be added up', () => {
      // assert & verify
      expect(['SPENDING', 'INCOME', 'NET', 'COUNT'].every((m) => isAdditive(m as Measure))).toBe(
        true,
      );
      expect(isAdditive('SAVINGS_RATE')).toBe(false);
      expect(isAdditive('AVERAGE')).toBe(false);
    });
  });

  describe('granularityOf and bucketLabel', () => {
    it('should read day, week and month buckets from their spacing', () => {
      // assert & verify
      expect(granularityOf(['2026-03-01', '2026-03-02'])).toBe('day');
      expect(granularityOf(['2026-03-02', '2026-03-09'])).toBe('week');
      expect(granularityOf(['2026-03-01', '2026-04-01'])).toBe('month');
      expect(granularityOf(['2026-03-01'])).toBe('month');
      expect(granularityOf(['2026-03-12'])).toBe('day');
    });

    it('should name a bucket', () => {
      // assert & verify
      expect(bucketLabel('2026-03-12', 'day')).toBe('Mar 12');
      expect(bucketLabel('2026-03-09', 'week')).toBe('Week of Mar 9');
      expect(bucketLabel('2026-03-01', 'month')).toBe('Mar 2026');
    });
  });

  describe('selectPeriod', () => {
    it('should filter to a bucket without changing the grouping', () => {
      // act
      const month = selectPeriod(base(), '2026-03-01', 'month', 'Mar 2026');
      const week = selectPeriod(base(), '2026-03-09', 'week', 'Week of Mar 9');
      const day = selectPeriod(base(), '2026-03-12', 'day', 'Mar 12');

      // assert & verify
      expect(month.period).toEqual({ start: '2026-03-01', end: '2026-03-31', label: 'Mar 2026' });
      expect(month.groupBy).toBe('CATEGORY');
      expect(month.leaf).toBe(false);
      expect(month.drill).toEqual([
        {
          groupBy: 'CATEGORY',
          filterKey: 'period',
          label: 'Mar 2026',
          value: '2026-03-01..2026-03-31',
        },
      ]);
      expect(week.period?.end).toBe('2026-03-15');
      expect(day.period).toEqual({ start: '2026-03-12', end: '2026-03-12', label: 'Mar 12' });
    });

    it('should stay inside the range and an earlier period', () => {
      // arrange
      const clipped = { ...base(), startDate: '2026-03-15', endDate: '2026-03-20' };

      // act
      const next = selectPeriod(clipped, '2026-03-01', 'month', 'Mar 2026');

      // assert & verify
      expect(next.period).toEqual({ start: '2026-03-15', end: '2026-03-20', label: 'Mar 2026' });
    });
  });

  describe('rangeText', () => {
    it('should name the real dates and stop at today for a period in progress', () => {
      // assert & verify
      expect(rangeText('2026-01-01', '2026-12-31', TODAY)).toBe('Jan 1 to Oct 25, 2026');
      expect(rangeText('2026-03-01', '2026-03-31', TODAY)).toBe('Mar 1 to Mar 31, 2026');
      expect(rangeText('2025-11-01', '2026-02-28', TODAY)).toBe('Nov 1, 2025 to Feb 28, 2026');
    });
  });

  describe('rootCrumb', () => {
    it('should name the start of the path for the measure', () => {
      // assert & verify
      expect(rootCrumb('SPENDING', 'SPENDING')).toBe('All spending');
      expect(rootCrumb('INCOME', 'SPENDING')).toBe('All income');
      expect(rootCrumb('COUNT', 'INCOME')).toBe('All income');
      expect(rootCrumb('AVERAGE', 'SPENDING')).toBe('All spending');
      expect(rootCrumb('NET', 'SPENDING')).toBe('All activity');
    });
  });

  describe('biggestRow', () => {
    const data = [
      row('1', 'Rent', 500, 500),
      row('2', 'Food', 400, 300),
      row('3', 'Fun', 100, 10),
      row('4', 'Gas', 50, 90),
    ];

    it('should pick the biggest increase when comparing', () => {
      // assert & verify
      expect(biggestRow(data, 'SAME_DAYS_LAST_YEAR')?.label).toBe('Food');
    });

    it('should pick the top row when not comparing, and nothing when nothing grew', () => {
      // assert & verify
      expect(biggestRow(data, 'NONE')?.label).toBe('Rent');
      expect(biggestRow([row('1', 'Rent', 5, 9)], 'PREVIOUS_PERIOD')).toBeNull();
      expect(biggestRow([], 'NONE')).toBeNull();
    });
  });

  describe('reconcileDrill', () => {
    it('should drop drill steps whose filter was edited away and keep the rest', () => {
      // arrange
      const deep = drill(drill(base(), row('5', 'Food')), row('8', 'Groceries'));

      // act
      const kept = reconcileDrill(deep);
      const edited = reconcileDrill({ ...deep, filters: { accountIds: [] } });
      const changed = reconcileDrill({
        ...deep,
        filters: { accountIds: [], categoryId: 99, categoryName: 'Other' },
      });

      // assert & verify
      expect(kept).toBe(deep);
      expect(edited.drill).toEqual([]);
      expect(changed.drill).toEqual([]);
    });

    it('should keep a step for the last value of a key, and period steps while the period holds', () => {
      // arrange
      const inMarch = selectPeriod(base(), '2026-03-01', 'month', 'Mar 2026');

      // act & assert & verify
      expect(reconcileDrill(inMarch)).toBe(inMarch);
      expect(reconcileDrill({ ...inMarch, period: null }).drill).toEqual([]);
      const flags = drill({ ...base(), groupBy: 'TAG' }, row(null, 'No tag'));
      expect(reconcileDrill({ ...flags, filters: { accountIds: [] } }).drill).toEqual([]);
      expect(reconcileDrill(flags)).toBe(flags);
    });
  });
});
