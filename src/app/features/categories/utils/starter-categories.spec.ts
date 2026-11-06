import { CategoryType } from '@models/category.model';
import { CATEGORY_COLORS } from '@shared/utils/category.utils';
import { CATEGORY_ICONS } from '../components/category-edit-form/category-edit-form.component';
import { BULK_MAX_GROUPS, BULK_MAX_NAME_LENGTH, BULK_MAX_NAMES } from './category-bulk';
import { STARTER_CATEGORIES } from './starter-categories';

describe('STARTER_CATEGORIES', () => {
  const subcategoryTotal: number = STARTER_CATEGORIES.reduce(
    (sum: number, p): number => sum + p.subcategories.length,
    0,
  );

  it('should offer 14 parents in the agreed order', () => {
    expect(STARTER_CATEGORIES.map((p) => p.name)).toEqual([
      'Income',
      'Housing',
      'Utilities',
      'Food',
      'Transportation',
      'Health',
      'Shopping',
      'Entertainment',
      'Subscriptions',
      'Education',
      'Debt and fees',
      'Giving and family',
      'Taxes',
      'Transfers',
    ]);
  });

  it('should have between 50 and 60 subcategories, and fit in one batch', () => {
    expect(subcategoryTotal).toBeGreaterThanOrEqual(50);
    expect(subcategoryTotal).toBeLessThanOrEqual(60);
    expect(STARTER_CATEGORIES.length).toBeLessThanOrEqual(BULK_MAX_GROUPS);
    expect(STARTER_CATEGORIES.length + subcategoryTotal).toBeLessThanOrEqual(BULK_MAX_NAMES);
  });

  it('should give every parent 3 to 5 subcategories', () => {
    for (const parent of STARTER_CATEGORIES) {
      expect(parent.subcategories.length).toBeGreaterThanOrEqual(3);
      expect(parent.subcategories.length).toBeLessThanOrEqual(5);
    }
  });

  it('should keep names non-blank, within the length limit, and unique', () => {
    const parents: string[] = STARTER_CATEGORIES.map((p) => p.name.toLowerCase());
    expect(new Set(parents).size).toBe(parents.length);
    for (const parent of STARTER_CATEGORIES) {
      const names: string[] = [parent.name, ...parent.subcategories];
      for (const name of names) {
        expect(name.trim()).toBe(name);
        expect(name.length).toBeGreaterThan(0);
        expect(name.length).toBeLessThanOrEqual(BULK_MAX_NAME_LENGTH);
      }
      const lower: string[] = parent.subcategories.map((s: string): string => s.toLowerCase());
      expect(new Set(lower).size).toBe(lower.length);
    }
  });

  it('should type Income as income, Transfers as transfer and everything else as expense', () => {
    for (const parent of STARTER_CATEGORIES) {
      const expected: CategoryType =
        parent.name === 'Income'
          ? CategoryType.INCOME
          : parent.name === 'Transfers'
            ? CategoryType.TRANSFER
            : CategoryType.EXPENSE;
      expect(parent.type).toBe(expected);
    }
  });

  it('should use only colors and icons the category forms offer', () => {
    for (const parent of STARTER_CATEGORIES) {
      expect(CATEGORY_COLORS).toContain(parent.color);
      expect(CATEGORY_ICONS).toContain(parent.icon);
    }
  });
});
