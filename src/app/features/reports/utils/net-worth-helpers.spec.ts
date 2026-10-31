import { NetWorthGroup, NetWorthMoved, NetWorthPoint } from '../models/reports.model';
import { defaultNetWorthState } from './net-worth-state';
import {
  accountExplorerQuery,
  accountsQuery,
  changeForGroup,
  chartData,
  debtPaidDownText,
  monthsCoveredText,
  movedRows,
  pointMonth,
  shareOfAssets,
  sparkline,
} from './net-worth-helpers';

const group = (over: Partial<NetWorthGroup> = {}): NetWorthGroup => ({
  key: 'SAVINGS',
  label: 'Savings',
  kind: 'ASSET',
  typeCode: 'SAVINGS',
  accountCount: 2,
  balance: 1120,
  previousBalance: 1000,
  comparisonBalance: null,
  series: [1000, 1120],
  story: null,
  ...over,
});
const point = (date: string, assets: number, debts: number): NetWorthPoint => ({
  date,
  assets,
  debts,
  netWorth: assets - debts,
  partial: false,
});

describe('net-worth-helpers (PF-887)', () => {
  describe('changeForGroup', () => {
    it('should say an asset that grew is up, with words, an arrow and a good tone', () => {
      // assert & verify
      expect(changeForGroup(group())).toEqual({ text: '▲ up 12%', tone: 'good' });
    });

    it('should say an asset that shrank is down with a bad tone', () => {
      // assert & verify
      expect(changeForGroup(group({ balance: 900 }))).toEqual({ text: '▼ down 10%', tone: 'bad' });
    });

    it('should say debt went down, and treat it as good, when the balance moved toward zero', () => {
      // arrange -- owed 500 before, 400 now
      const card = group({ kind: 'DEBT', balance: -400, previousBalance: -500 });

      // assert & verify
      expect(changeForGroup(card)).toEqual({ text: '▼ debt down 20%', tone: 'good' });
    });

    it('should say debt went up, and treat it as bad, when more is owed', () => {
      // arrange
      const card = group({ kind: 'DEBT', balance: -600, previousBalance: -500 });

      // assert & verify
      expect(changeForGroup(card)).toEqual({ text: '▲ debt up 20%', tone: 'bad' });
    });

    it('should compare with the comparison balance when there is one', () => {
      // assert & verify
      expect(changeForGroup(group({ comparisonBalance: 560 }))).toEqual({
        text: '▲ up 100%',
        tone: 'good',
      });
    });

    it('should say no change when the balance did not move', () => {
      // assert & verify
      expect(changeForGroup(group({ balance: 1000 }))).toEqual({
        text: 'no change',
        tone: 'neutral',
      });
    });

    it('should give the amount instead of a percentage when the starting balance was zero', () => {
      // assert & verify
      expect(changeForGroup(group({ balance: 250, previousBalance: 0 }))).toEqual({
        text: '▲ up $250',
        tone: 'good',
      });
    });
  });

  describe('debtPaidDownText', () => {
    it('should say paid down in whole dollars when debt fell', () => {
      // assert & verify
      expect(debtPaidDownText(4350)).toBe('paid down $4,350');
    });

    it('should say the debt grew when it rose, and no change at zero', () => {
      // assert & verify
      expect(debtPaidDownText(-120)).toBe('grew by $120');
      expect(debtPaidDownText(0)).toBe('no change');
    });
  });

  describe('monthsCoveredText', () => {
    it('should say how many months liquid cash covers, to one decimal', () => {
      // assert & verify
      expect(monthsCoveredText(4.1)).toBe('covers 4.1 months of spending');
      expect(monthsCoveredText(1)).toBe('covers 1 month of spending');
    });

    it('should show a dash when there is no spending to compare with', () => {
      // assert & verify
      expect(monthsCoveredText(null)).toBe('—');
    });
  });

  describe('movedRows', () => {
    it('should use the verbatim labels, in order', () => {
      // arrange
      const moved: NetWorthMoved = { change: 14120, saved: 9860, other: 4260 };

      // assert & verify
      expect(movedRows(moved)).toEqual([
        { label: 'Saved: income minus spending', amount: 9860 },
        { label: 'Investment growth and other adjustments', amount: 4260 },
        { label: 'Total change', amount: 14120 },
      ]);
    });
  });

  describe('chartData', () => {
    const points = [point('2026-08-31', 5820, 300), point('2026-09-30', 5970, 400)];

    it('should draw assets above zero, debts below it and net worth as a line', () => {
      // act
      const data = chartData(points, 'NET_WORTH');

      // assert & verify
      expect(data.labels).toEqual(['Aug', 'Sep']);
      expect(data.assets).toEqual([5820, 5970]);
      expect(data.debts).toEqual([-300, -400]);
      expect(data.netWorth).toEqual([5520, 5570]);
    });

    it('should plot only the chosen side for Assets or Debts', () => {
      // assert & verify
      expect(chartData(points, 'ASSETS').debts).toEqual([]);
      expect(chartData(points, 'ASSETS').netWorth).toEqual([]);
      expect(chartData(points, 'DEBTS').assets).toEqual([]);
      expect(chartData(points, 'DEBTS').debts).toEqual([-300, -400]);
    });

    it('should put the year in the label when the range crosses a year', () => {
      // act
      const data = chartData([point('2025-12-31', 1, 0), point('2026-01-31', 1, 0)], 'NET_WORTH');

      // assert & verify
      expect(data.labels).toEqual(['Dec 25', 'Jan 26']);
    });

    it('should give no points for no data', () => {
      // assert & verify
      expect(chartData([], 'NET_WORTH')).toEqual({
        labels: [],
        assets: [],
        debts: [],
        netWorth: [],
      });
    });
  });

  describe('pointMonth', () => {
    it('should turn a month end into yyyy-MM', () => {
      // assert & verify
      expect(pointMonth('2026-09-30')).toBe('2026-09');
    });
  });

  describe('sparkline', () => {
    it('should draw a line through the points scaled to the box', () => {
      // assert & verify
      expect(sparkline([0, 10], 100, 20)).toBe('M0,20 L100,0');
    });

    it('should draw a flat line at mid height when every value is the same', () => {
      // assert & verify
      expect(sparkline([5, 5, 5], 100, 20)).toBe('M0,10 L50,10 L100,10');
    });

    it('should leave a gap where the series is null', () => {
      // assert & verify
      expect(sparkline([0, null, 10, 20], 90, 20)).toBe('M60,10 L90,0');
    });

    it('should draw nothing for fewer than two points', () => {
      // assert & verify
      expect(sparkline([])).toBe('');
      expect(sparkline([4])).toBe('');
      expect(sparkline([null, 4, null])).toBe('');
    });
  });

  describe('explorer and accounts links', () => {
    it('should open the explorer on that account, spending by category, over the net worth range', () => {
      // arrange
      const state = { ...defaultNetWorthState(new Date(2026, 9, 25)), accountId: 9 };

      // act
      const query = accountExplorerQuery(
        group({ key: '9', label: 'Ally' }),
        state,
        new Date(2026, 9, 25),
      );

      // assert & verify
      expect(query['accountIds']).toBe('9');
      expect(query['measure']).toBe('SPENDING');
      expect(query['groupBy']).toBe('CATEGORY');
      expect(query['range']).toBe('Last 12 months');
      expect(query['startDate']).toBe('2025-10-26');
      expect(query['endDate']).toBe('2026-10-25');
    });

    it('should open Accounts at that account', () => {
      // assert & verify
      expect(accountsQuery(9)).toEqual({ accountId: 9 });
    });
  });

  describe('shareOfAssets', () => {
    it('should be the group balance as a percentage of all assets', () => {
      // assert & verify
      expect(shareOfAssets(group({ balance: 250 }), 1000)).toBe(25);
    });

    it('should be zero for a debt, or when there are no assets', () => {
      // assert & verify
      expect(shareOfAssets(group({ kind: 'DEBT', balance: -50 }), 1000)).toBe(0);
      expect(shareOfAssets(group({ balance: 250 }), 0)).toBe(0);
    });
  });
});
