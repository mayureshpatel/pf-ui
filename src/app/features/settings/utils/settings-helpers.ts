import { Params } from '@angular/router';
import { CategoryRule } from '@models/category-rule.model';
import { Tag } from '@models/tag.model';

export type SettingsSection = 'appearance' | 'rules' | 'tags';

const SECTIONS: SettingsSection[] = ['appearance', 'rules', 'tags'];
const MAX_KEYWORD_LENGTH = 255;

/** The section a `section` query parameter names; anything unknown shows the category rules. */
export function sectionFromParam(value: unknown): SettingsSection {
  const first: unknown = Array.isArray(value) ? value[0] : value;
  return SECTIONS.includes(first as SettingsSection) ? (first as SettingsSection) : 'rules';
}

/** Splits comma-separated keywords, trimming, dropping blanks and exact duplicates, keeping order. */
export function parseKeywords(input: string): string[] {
  const seen = new Set<string>();
  return input
    .split(',')
    .map((keyword: string): string => keyword.trim())
    .filter((keyword: string): boolean => {
      if (keyword === '' || seen.has(keyword)) return false;
      seen.add(keyword);
      return true;
    });
}

export const joinKeywords = (keywords: string[]): string => keywords.join(', ');

/** Whether any keyword is longer than the server allows. */
export const keywordTooLong = (keywords: string[]): boolean =>
  keywords.some((keyword: string): boolean => keyword.length > MAX_KEYWORD_LENGTH);

/** Highest priority first (it wins), then oldest first. Returns a new array. */
export function sortRules(rules: CategoryRule[]): CategoryRule[] {
  return [...rules].sort(
    (a: CategoryRule, b: CategoryRule) => b.priority - a.priority || a.id - b.id,
  );
}

/** Rules whose keywords or category name contain the term, ignoring case; a blank term keeps all. */
export function filterRules(rules: CategoryRule[], term: string): CategoryRule[] {
  const needle: string = term.trim().toLowerCase();
  if (needle === '') return rules;
  return rules.filter(
    (rule: CategoryRule): boolean =>
      rule.category?.name.toLowerCase().includes(needle) ||
      rule.keywords.some((keyword: string): boolean => keyword.toLowerCase().includes(needle)),
  );
}

const dollars = (value: number): string =>
  Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;

/** The amount limits in words, or an empty string when there are none. */
export function amountLimitText(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return `${dollars(min)} to ${dollars(max)}`;
  if (min !== null) return `${dollars(min)} or more`;
  if (max !== null) return `up to ${dollars(max)}`;
  return '';
}

export function amountRangeError(min: number | null, max: number | null): string | null {
  return min !== null && max !== null && min > max
    ? "The minimum can't be more than the maximum."
    : null;
}

/** By name ignoring case, then oldest first. Returns a new array. */
export function sortTags(tags: Tag[]): Tag[] {
  return [...tags].sort(
    (a: Tag, b: Tag) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.id - b.id,
  );
}

export function filterTags(tags: Tag[], term: string): Tag[] {
  const needle: string = term.trim().toLowerCase();
  return needle === ''
    ? tags
    : tags.filter((tag: Tag): boolean => tag.name.toLowerCase().includes(needle));
}

/** The Transactions page's parameters for a tag, across all time. */
export const tagTransactionsQuery = (tag: Tag): Params => ({
  tagId: String(tag.id),
  period: 'all',
});
