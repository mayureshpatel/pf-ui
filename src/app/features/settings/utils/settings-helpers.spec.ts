import { Category } from '@models/category.model';
import { CategoryRule } from '@models/category-rule.model';
import { Tag } from '@models/tag.model';
import {
  amountLimitText,
  amountRangeError,
  filterRules,
  filterTags,
  joinKeywords,
  keywordTooLong,
  parseKeywords,
  sectionFromParam,
  sortRules,
  sortTags,
  tagTransactionsQuery,
} from './settings-helpers';

const rule = (id: number, priority: number, keywords: string[], category = 'Food'): CategoryRule =>
  ({
    id,
    userId: 1,
    keywords,
    matchType: 'OR',
    priority,
    category: { id: 5, name: category } as Category,
    minAmount: null,
    maxAmount: null,
  }) as CategoryRule;
const tag = (id: number, name: string): Tag => ({ id, userId: 1, name, color: null });

describe('settings helpers', () => {
  describe('sectionFromParam', () => {
    it('should accept each section and fall back to rules for anything else', () => {
      // assert & verify
      expect(sectionFromParam('appearance')).toBe('appearance');
      expect(sectionFromParam('rules')).toBe('rules');
      expect(sectionFromParam('tags')).toBe('tags');
      expect(sectionFromParam(undefined)).toBe('rules');
      expect(sectionFromParam('')).toBe('rules');
      expect(sectionFromParam('nope')).toBe('rules');
      expect(sectionFromParam(['tags'])).toBe('tags');
      expect(sectionFromParam(['x'])).toBe('rules');
    });
  });

  describe('keywords', () => {
    it('should split, trim, drop blanks and exact duplicates, keeping order', () => {
      // assert & verify
      expect(parseKeywords(' a, b ,, c,a ')).toEqual(['a', 'b', 'c']);
      expect(parseKeywords(',, ,')).toEqual([]);
      expect(parseKeywords('net flix, spotify')).toEqual(['net flix', 'spotify']);
    });

    it('should round trip through join', () => {
      // arrange
      const keywords = ['netflix', 'spotify premium'];

      // act & assert & verify
      expect(joinKeywords(keywords)).toBe('netflix, spotify premium');
      expect(parseKeywords(joinKeywords(keywords))).toEqual(keywords);
    });

    it('should flag a keyword over 255 characters', () => {
      // assert & verify
      expect(keywordTooLong(['a'.repeat(255)])).toBe(false);
      expect(keywordTooLong(['ok', 'a'.repeat(256)])).toBe(true);
    });
  });

  describe('rules', () => {
    it('should sort by priority descending, then id, without mutating the input', () => {
      // arrange
      const input = [rule(3, 1, ['c']), rule(1, 5, ['a']), rule(2, 5, ['b'])];

      // act
      const sorted = sortRules(input);

      // assert & verify
      expect(sorted.map((r) => r.id)).toEqual([1, 2, 3]);
      expect(input.map((r) => r.id)).toEqual([3, 1, 2]);
    });

    it('should filter by keyword or category name, case-insensitively', () => {
      // arrange
      const rules = [rule(1, 0, ['Netflix'], 'Streaming'), rule(2, 0, ['shell'], 'Gas')];

      // assert & verify
      expect(filterRules(rules, 'netf').map((r) => r.id)).toEqual([1]);
      expect(filterRules(rules, 'GAS').map((r) => r.id)).toEqual([2]);
      expect(filterRules(rules, '  ')).toHaveLength(2);
      expect(filterRules(rules, 'zzz')).toEqual([]);
    });

    it('should word the amount limits', () => {
      // assert & verify
      expect(amountLimitText(50, null)).toBe('$50 or more');
      expect(amountLimitText(null, 200)).toBe('up to $200');
      expect(amountLimitText(50, 200)).toBe('$50 to $200');
      expect(amountLimitText(null, null)).toBe('');
      expect(amountLimitText(50.5, null)).toBe('$50.50 or more');
      expect(amountLimitText(0, 10)).toBe('$0 to $10');
    });

    it('should report a minimum above the maximum', () => {
      // assert & verify
      expect(amountRangeError(10, 5)).toBe("The minimum can't be more than the maximum.");
      expect(amountRangeError(5, 5)).toBeNull();
      expect(amountRangeError(null, 5)).toBeNull();
      expect(amountRangeError(5, null)).toBeNull();
    });
  });

  describe('tags', () => {
    it('should sort by name case-insensitively, then id', () => {
      // assert & verify
      expect(
        sortTags([tag(2, 'Banana'), tag(3, 'apple'), tag(1, 'apple')]).map((t) => t.id),
      ).toEqual([1, 3, 2]);
    });

    it('should filter by name', () => {
      // assert & verify
      expect(filterTags([tag(1, 'Trip'), tag(2, 'Tax')], 'tr').map((t) => t.id)).toEqual([1]);
      expect(filterTags([tag(1, 'Trip')], '')).toHaveLength(1);
    });

    it('should link to the tag on the transactions page for all time', () => {
      // assert & verify
      expect(tagTransactionsQuery(tag(7, 'Trip'))).toEqual({ tagId: '7', period: 'all' });
    });
  });
});
