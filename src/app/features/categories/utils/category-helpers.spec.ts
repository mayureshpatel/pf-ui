import { Category, CategoryType } from '@models/category.model';
import {
  NO_FILTER,
  availableTypes,
  buildNodes,
  categoryStats,
  deleteOrder,
  filterNodes,
  isFiltering,
  isTickable,
  isUnused,
  parentOptions,
} from './category-helpers';

const cat = (
  id: number,
  name: string,
  parent: Category | null = null,
  type: CategoryType = CategoryType.EXPENSE,
): Category =>
  ({ id, userId: 1, name, type, parent, icon: 'pi-tag', color: '#3B82F6' }) as Category;

const food = cat(1, 'Food');
const groceries = cat(2, 'Groceries', food);
const dining = cat(3, 'Dining out', food);
const coffee = cat(4, 'Coffee', food);
const housing = cat(5, 'Housing');
const travel = cat(6, 'Travel');
const income = cat(7, 'Income', null, CategoryType.INCOME);
const paycheck = cat(8, 'Paycheck', income, CategoryType.INCOME);
const flat = [paycheck, travel, coffee, housing, dining, income, groceries, food];
const counts = [
  { ...groceries, transactionCount: 301 },
  { ...dining, transactionCount: 98 },
  { ...housing, transactionCount: 12 },
  { ...paycheck, transactionCount: 24 },
];
const nodes = () => buildNodes(flat, counts);
const names = (list: { parent: Category; children: Category[] }[]) =>
  list.map((n) => [n.parent.name, n.children.map((c) => c.name)]);

describe('category-helpers', () => {
  describe('buildNodes', () => {
    it('should set own counts, sort by name ignoring case and total a parent with its children', () => {
      // act
      const result = nodes();

      // assert & verify
      expect(result.map((n) => n.parent.name)).toEqual(['Food', 'Housing', 'Income', 'Travel']);
      expect(result[0].children.map((c) => c.name)).toEqual(['Coffee', 'Dining out', 'Groceries']);
      expect(result[0].parent.transactionCount).toBe(0);
      expect(result[0].children[2].transactionCount).toBe(301);
      expect(result[0].totalCount).toBe(399);
      expect(result[1].totalCount).toBe(12);
    });
  });

  describe('isUnused', () => {
    it('should be true for zero or a missing count and false otherwise', () => {
      // assert & verify
      expect(isUnused({ ...food, transactionCount: 0 })).toBe(true);
      expect(isUnused(food)).toBe(true);
      expect(isUnused({ ...food, transactionCount: 1 })).toBe(false);
    });
  });

  describe('filterNodes', () => {
    it('should keep a parent when only a child matches the search', () => {
      // act
      const result = filterNodes(nodes(), { ...NO_FILTER, search: 'coff' });

      // assert & verify
      expect(names(result)).toEqual([['Food', ['Coffee']]]);
    });

    it('should hide the children when only the parent matches, case-insensitively', () => {
      // act
      const result = filterNodes(nodes(), { ...NO_FILTER, search: 'FOOD' });

      // assert & verify
      expect(names(result)).toEqual([['Food', []]]);
    });

    it('should combine the type filter with the search', () => {
      // act
      const result = filterNodes(nodes(), {
        ...NO_FILTER,
        type: CategoryType.INCOME,
        search: 'pay',
      });

      // assert & verify
      expect(names(result)).toEqual([['Income', ['Paycheck']]]);
    });

    it('should show only unused categories, keeping a used parent that has an unused child', () => {
      // act
      const result = filterNodes(nodes(), { ...NO_FILTER, unusedOnly: true });

      // assert & verify
      expect(names(result)).toEqual([
        ['Food', ['Coffee']],
        ['Income', []],
        ['Travel', []],
      ]);
    });

    it('should return everything with no filter and report whether a filter is active', () => {
      // assert & verify
      expect(filterNodes(nodes(), NO_FILTER)).toEqual(nodes());
      expect(isFiltering(NO_FILTER)).toBe(false);
      expect(isFiltering({ ...NO_FILTER, search: ' ' })).toBe(false);
      expect(isFiltering({ ...NO_FILTER, search: 'a' })).toBe(true);
      expect(isFiltering({ ...NO_FILTER, unusedOnly: true })).toBe(true);
      expect(isFiltering({ ...NO_FILTER, type: CategoryType.INCOME })).toBe(true);
    });
  });

  describe('availableTypes', () => {
    it('should always offer Expense and Income, and Transfer or Both only when present', () => {
      // assert & verify
      expect(availableTypes(flat)).toEqual([CategoryType.EXPENSE, CategoryType.INCOME]);
      expect(availableTypes([...flat, cat(9, 'Move', null, CategoryType.TRANSFER)])).toEqual([
        CategoryType.EXPENSE,
        CategoryType.INCOME,
        CategoryType.TRANSFER,
      ]);
    });
  });

  describe('categoryStats', () => {
    it('should count categories, groups, transactions and unused categories', () => {
      // assert & verify
      expect(categoryStats(nodes().flatMap((n) => [n.parent, ...n.children]))).toEqual({
        categories: 8,
        groups: 4,
        transactions: 435,
        unused: 4,
      });
    });
  });

  describe('isTickable', () => {
    it('should never allow a used category and allow a childless unused parent', () => {
      // assert & verify
      const n = nodes();
      expect(isTickable(n[1].parent, n, new Set())).toBe(false);
      expect(isTickable(n[3].parent, n, new Set())).toBe(true);
    });

    it('should allow a parent with children only once all its children are ticked', () => {
      // arrange -- Food is unused, but Groceries and Dining out are used so they can never be ticked
      const n = buildNodes([food, { ...coffee }], []);

      // assert & verify
      expect(isTickable(n[0].parent, n, new Set())).toBe(false);
      expect(isTickable(n[0].parent, n, new Set([coffee.id]))).toBe(true);
    });
  });

  describe('deleteOrder', () => {
    it('should run subcategories before parents and ignore unknown ids', () => {
      // assert & verify
      expect(deleteOrder([food.id, coffee.id], flat)).toEqual([[coffee.id], [food.id]]);
      expect(deleteOrder([travel.id, 999], flat)).toEqual([[travel.id]]);
      expect(deleteOrder([], flat)).toEqual([]);
    });
  });

  describe('parentOptions', () => {
    it('should offer top-level categories other than the one being edited', () => {
      // assert & verify
      expect(parentOptions(flat, travel).map((c) => c.name)).toEqual(['Housing', 'Income', 'Food']);
      expect(parentOptions(flat, groceries).map((c) => c.id)).not.toContain(groceries.id);
      expect(parentOptions(flat, null).every((c) => !c.parent)).toBe(true);
    });

    it('should offer nothing to a category that has subcategories', () => {
      // assert & verify
      expect(parentOptions(flat, food)).toEqual([]);
    });
  });
});
