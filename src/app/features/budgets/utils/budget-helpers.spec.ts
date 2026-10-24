import { Budget, BudgetStatus } from '@models/budget.model';
import { Category } from '@models/category.model';
import {
  budgetRows,
  budgetTotals,
  copyPlan,
  groupBudgetRows,
  groupKeyOf,
  isUnbudgeted,
  isSameMonth,
  monthLabel,
  shiftMonth,
  unbudgetedCategories,
  usedPercent,
} from './budget-helpers';

const cat = (id: number, name: string, parent: Category | null = null): Category =>
  ({ id, name, parent, icon: 'pi-tag', color: '#10b981' }) as unknown as Category;

const status = (id: number, name: string, budgeted: number, spent: number): BudgetStatus => ({
  category: cat(id, name),
  budgetedAmount: budgeted,
  spentAmount: spent,
  remainingAmount: budgeted - spent,
  percentageUsed: budgeted > 0 ? (spent / budgeted) * 100 : 0,
});

const budget = (id: number, categoryId: number, amount: number): Budget =>
  ({
    id,
    userId: 1,
    category: cat(categoryId, `C${categoryId}`),
    amount,
    month: 10,
    year: 2026,
  }) as Budget;

describe('budget-helpers', () => {
  describe('groupKeyOf', () => {
    it('should put exactly 85% and exactly 100% in Close and 100.01% in Over', () => {
      // assert & verify
      expect(groupKeyOf(status(1, 'A', 100, 84.99))).toBe('ON_TRACK');
      expect(groupKeyOf(status(1, 'A', 100, 85))).toBe('CLOSE');
      expect(groupKeyOf(status(1, 'A', 100, 100))).toBe('CLOSE');
      expect(groupKeyOf(status(1, 'A', 100, 100.01))).toBe('OVER');
    });

    it('should treat a $0 limit as On track with nothing spent and Over with any spending', () => {
      // assert & verify
      expect(groupKeyOf(status(1, 'A', 0, 0))).toBe('ON_TRACK');
      expect(groupKeyOf(status(1, 'A', 0, 0.01))).toBe('OVER');
    });

    it('should not let floating point noise flip a group', () => {
      // assert & verify -- 0.1 + 0.2 is 0.30000000000000004 but the limit is exactly $0.30
      expect(groupKeyOf(status(1, 'A', 0.3, 0.1 + 0.2))).toBe('CLOSE');
    });
  });

  describe('usedPercent', () => {
    it('should round to one decimal and handle a $0 limit', () => {
      // assert & verify
      expect(usedPercent(status(1, 'A', 300, 100))).toBe(33.3);
      expect(usedPercent(status(1, 'A', 0, 5))).toBe(100);
      expect(usedPercent(status(1, 'A', 0, 0))).toBe(0);
    });
  });

  describe('budgetRows', () => {
    it('should attach the budget id by category and leave null when there is none', () => {
      // act
      const rows = budgetRows([status(1, 'A', 10, 1), status(2, 'B', 10, 1)], [budget(77, 1, 10)]);

      // assert & verify
      expect(rows.map((r) => r.budgetId)).toEqual([77, null]);
    });
  });

  describe('groupBudgetRows', () => {
    it('should order Over, Close, On track, omit empty groups and sort rows by use then name', () => {
      // arrange
      const rows = budgetRows(
        [
          status(1, 'Utilities', 300, 140),
          status(2, 'Groceries', 450, 512),
          status(3, 'Dining out', 200, 184),
          status(4, 'Alpha', 100, 47),
          status(5, 'Beta', 100, 47),
        ],
        [],
      );

      // act
      const groups = groupBudgetRows(rows);

      // assert & verify
      expect(groups.map((g) => g.key)).toEqual(['OVER', 'CLOSE', 'ON_TRACK']);
      expect(groups.map((g) => g.label)).toEqual([
        'Over the limit',
        'Close to the limit',
        'On track',
      ]);
      expect(groups[2].rows.map((r) => r.status.category.name)).toEqual([
        'Alpha',
        'Beta',
        'Utilities',
      ]);
      expect(groupBudgetRows([])).toEqual([]);
    });

    it('should subtotal what is left in cents, negative for the over group', () => {
      // arrange
      const rows = budgetRows([status(1, 'A', 450, 512), status(2, 'B', 100.1, 50.2)], []);

      // act
      const groups = groupBudgetRows(rows);

      // assert & verify
      expect(groups[0].leftSubtotal).toBe(-62);
      expect(groups[1].leftSubtotal).toBe(49.9);
    });
  });

  describe('budgetTotals', () => {
    it('should total budgeted, spent and left, and be zero for an empty month', () => {
      // assert & verify
      const rows = budgetRows(
        [status(1, 'A', 450, 512), status(2, 'B', 200, 184)],
        [budget(1, 1, 450), budget(2, 2, 200)],
      );
      expect(budgetTotals(rows)).toEqual({ budgeted: 650, spent: 696, left: -46, unbudgeted: 0 });
      expect(budgetTotals([])).toEqual({ budgeted: 0, spent: 0, left: 0, unbudgeted: 0 });
    });
  });

  describe('categories with spending but no budget', () => {
    it('should recognise a row with no budget and no limit, but not a $0 budget or a missing id with a limit', () => {
      // assert & verify
      expect(isUnbudgeted({ status: status(1, 'A', 0, 120), budgetId: null })).toBe(true);
      expect(isUnbudgeted({ status: status(1, 'A', 0, 120), budgetId: 5 })).toBe(false);
      expect(isUnbudgeted({ status: status(1, 'A', 450, 120), budgetId: null })).toBe(false);
    });

    it('should list them last in a No limit set group with what was spent, most first', () => {
      // arrange
      const rows = budgetRows(
        [status(1, 'Groceries', 450, 100), status(2, 'Gifts', 0, 30), status(3, 'Fuel', 0, 80)],
        [budget(11, 1, 450)],
      );

      // act
      const groups = groupBudgetRows(rows);

      // assert & verify
      expect(groups.map((g) => g.key)).toEqual(['ON_TRACK', 'UNBUDGETED']);
      expect(groups[1].label).toBe('No limit set');
      expect(groups[1].rows.map((r) => r.status.category.name)).toEqual(['Fuel', 'Gifts']);
      expect(groups[1].spentSubtotal).toBe(110);
    });

    it('should leave them out of the budgeted, spent and left totals and report them separately', () => {
      // arrange
      const rows = budgetRows(
        [status(1, 'Groceries', 450, 100), status(2, 'Gifts', 0, 30)],
        [budget(11, 1, 450)],
      );

      // assert & verify
      expect(budgetTotals(rows)).toEqual({ budgeted: 450, spent: 100, left: 350, unbudgeted: 30 });
    });
  });

  describe('copyPlan', () => {
    it('should add categories missing this month and overwrite only differing amounts', () => {
      // arrange
      const last = [budget(1, 1, 100), budget(2, 2, 200), budget(3, 3, 300)];
      const current = [budget(10, 2, 200), budget(11, 3, 350), budget(12, 9, 50)];

      // act
      const plan = copyPlan(last, current);

      // assert & verify
      expect(plan.add.map((b) => b.category.id)).toEqual([1]);
      expect(plan.overwrite.map((b) => b.category.id)).toEqual([3]);
    });

    it('should plan nothing when last month is empty', () => {
      // assert & verify
      expect(copyPlan([], [budget(1, 1, 10)])).toEqual({ add: [], overwrite: [] });
    });
  });

  describe('unbudgetedCategories', () => {
    it('should offer only categories without a budget this month', () => {
      // assert & verify
      expect(
        unbudgetedCategories([cat(1, 'A'), cat(2, 'B')], [budget(5, 1, 10)]).map((c) => c.id),
      ).toEqual([2]);
    });
  });

  describe('months', () => {
    it('should label, shift across year boundaries and compare months', () => {
      // assert & verify
      expect(monthLabel(10, 2026)).toBe('October 2026');
      expect(shiftMonth(12, 2026, 1)).toEqual({ month: 1, year: 2027 });
      expect(shiftMonth(1, 2026, -1)).toEqual({ month: 12, year: 2025 });
      expect(isSameMonth(10, 2026, new Date(2026, 9, 24))).toBe(true);
      expect(isSameMonth(9, 2026, new Date(2026, 9, 24))).toBe(false);
    });
  });
});
