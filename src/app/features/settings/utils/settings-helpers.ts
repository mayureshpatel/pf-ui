import { Params } from '@angular/router';
import { CategoryRule } from '@models/category-rule.model';
import { MerchantRule } from '@models/merchant-rule.model';
import { Tag } from '@models/tag.model';

export type SettingsSection = 'appearance' | 'rules' | 'merchant-rules' | 'tags';

const SECTIONS: SettingsSection[] = ['appearance', 'rules', 'merchant-rules', 'tags'];
const MAX_KEYWORD_LENGTH = 255;
/** The most keywords one rule may hold, as the server allows. */
export const MAX_KEYWORDS = 20;

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
export function sortRules<T extends { id: number; priority: number }>(rules: T[]): T[] {
  return [...rules].sort((a: T, b: T) => b.priority - a.priority || a.id - b.id);
}

/** Rules whose keywords or target name contain the term, ignoring case; a blank term keeps all. */
function filterByTerm<T extends { keywords: string[] }>(
  rules: T[],
  term: string,
  targetName: (rule: T) => string | undefined,
): T[] {
  const needle: string = term.trim().toLowerCase();
  if (needle === '') return rules;
  return rules.filter(
    (rule: T): boolean =>
      targetName(rule)?.toLowerCase().includes(needle) ||
      rule.keywords.some((keyword: string): boolean => keyword.toLowerCase().includes(needle)),
  );
}

/** Category rules whose keywords or category name contain the term, ignoring case; a blank term keeps all. */
export function filterRules(rules: CategoryRule[], term: string): CategoryRule[] {
  return filterByTerm(rules, term, (rule: CategoryRule) => rule.category?.name);
}

/** Merchant rules whose keywords or merchant name contain the term, ignoring case; a blank term keeps all. */
export function filterMerchantRules(rules: MerchantRule[], term: string): MerchantRule[] {
  return filterByTerm(rules, term, (rule: MerchantRule) => rule.merchant?.name);
}

/**
 * Names a rule by its keywords, e.g. `a rule with keywords "kroger", "431"`. The previews do not say
 * whether a rule needs any or all of them, so the wording is neutral: each keyword is quoted and the
 * list is labelled as the rule's keywords, never joined by "+" or "or".
 */
export function ruleKeywordsText(keywords: string[]): string {
  const quoted: string = keywords.map((k: string): string => `"${k}"`).join(', ');
  return `a rule with ${keywords.length === 1 ? 'keyword' : 'keywords'} ${quoted}`;
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

const DARK_TEXT = '#1c1917';
const LIGHT_TEXT = '#ffffff';

const channel = (value: number): number => {
  const c: number = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string): number =>
  0.2126 * channel(parseInt(hex.slice(0, 2), 16)) +
  0.7152 * channel(parseInt(hex.slice(2, 4), 16)) +
  0.0722 * channel(parseInt(hex.slice(4, 6), 16));

/**
 * Dark or white text, whichever reads better on a tag's own colour (white on a mid blue is only 3.7:1).
 * Anything that is not a 6-digit hex gets white.
 */
export function readableTextColor(color: string | null | undefined): string {
  const hex: string = (color ?? '').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return LIGHT_TEXT;
  const l: number = luminance(hex);
  const withWhite: number = 1.05 / (l + 0.05);
  const withDark: number = (l + 0.05) / (luminance(DARK_TEXT.slice(1)) + 0.05);
  return withDark > withWhite ? DARK_TEXT : LIGHT_TEXT;
}

/** The colour a tag without one is drawn in. */
export const DEFAULT_TAG_COLOR = '#94a3b8';

/** A stored colour as a bare 6-digit hex: 3-digit colours are expanded, anything unreadable becomes empty. */
export function normalizeHex(color: string | null | undefined): string {
  const hex: string = (color ?? '').replace('#', '');
  if (/^[0-9a-fA-F]{3}$/.test(hex)) return [...hex].map((c: string): string => c + c).join('');
  return /^[0-9a-fA-F]{6}$/.test(hex) ? hex : '';
}
