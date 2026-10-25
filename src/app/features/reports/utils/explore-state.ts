import { Params } from '@angular/router';
import { fromLocalDateString, toLocalDateString } from '@shared/utils/transaction.utils';
import {
  Compare,
  DrillFilterKey,
  DrillStep,
  ExploreFilters,
  ExploreState,
  GroupBy,
  Measure,
  Period,
  Side,
  SortKey,
} from '../models/reports.model';

export const MEASURES: Measure[] = [
  'SPENDING',
  'INCOME',
  'NET',
  'SAVINGS_RATE',
  'COUNT',
  'AVERAGE',
];
export const SIDES: Side[] = ['SPENDING', 'INCOME'];
export const GROUP_BYS: GroupBy[] = [
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
export const COMPARES: Compare[] = ['NONE', 'PREVIOUS_PERIOD', 'SAME_DAYS_LAST_YEAR'];
export const SORTS: SortKey[] = ['value', 'change', 'name', 'count'];
export const TIME_GROUPINGS: GroupBy[] = ['MONTH', 'WEEK', 'DAY'];
/** Net and savings rate compare income with spending, which only reads sensibly bucketed by time. */
export const TIME_ONLY_MEASURES: Measure[] = ['NET', 'SAVINGS_RATE'];

const DRILL_KEYS: DrillFilterKey[] = [
  'categoryId',
  'uncategorized',
  'merchantId',
  'noMerchant',
  'accountIds',
  'tagId',
  'noTag',
  'period',
];
const FLAG_KEYS: DrillFilterKey[] = ['uncategorized', 'noMerchant', 'noTag'];
const NUMBER_KEYS: DrillFilterKey[] = ['categoryId', 'merchantId', 'accountIds', 'tagId'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** The default view: this year's spending by category. */
export function defaultState(today: Date = new Date()): ExploreState {
  const year: number = today.getFullYear();
  return {
    measure: 'SPENDING',
    side: 'SPENDING',
    groupBy: 'CATEGORY',
    startDate: toLocalDateString(new Date(year, 0, 1)),
    endDate: toLocalDateString(new Date(year, 11, 31)),
    rangeLabel: 'This year',
    compare: 'NONE',
    sort: 'value',
    filters: { accountIds: [] },
    drill: [],
    leaf: false,
    period: null,
  };
}

export const DEFAULT_STATE: ExploreState = defaultState();

/** The dates a query covers: the drilled period when there is one, else the range. */
export function effectiveDates(state: ExploreState): { startDate: string; endDate: string } {
  return state.period
    ? { startDate: state.period.start, endDate: state.period.end }
    : { startDate: state.startDate, endDate: state.endDate };
}

const encodeStep = (step: DrillStep): string =>
  `${step.groupBy}|${step.filterKey}|${String(step.value)}|${step.label}`;

/**
 * The state as URL query parameters. Defaults are left out so links stay short; the measure, grouping
 * and dates are always present so a link means the same thing tomorrow.
 */
export function toQueryParams(state: ExploreState): Params {
  const params: Params = {
    measure: state.measure,
    groupBy: state.groupBy,
    startDate: state.startDate,
    endDate: state.endDate,
    range: state.rangeLabel,
  };
  if (state.side !== 'SPENDING') params['side'] = state.side;
  if (state.compare !== 'NONE') params['compare'] = state.compare;
  if (state.sort !== 'value') params['sort'] = state.sort;
  if (state.leaf) params['leaf'] = '1';

  const f: ExploreFilters = state.filters;
  if (f.accountIds.length) params['accountIds'] = f.accountIds.join(',');
  if (f.categoryId !== undefined) params['categoryId'] = String(f.categoryId);
  if (f.categoryName) params['categoryName'] = f.categoryName;
  if (f.uncategorized) params['uncategorized'] = 'true';
  if (f.merchantId !== undefined) params['merchantId'] = String(f.merchantId);
  if (f.merchantName) params['merchantName'] = f.merchantName;
  if (f.noMerchant) params['noMerchant'] = 'true';
  if (f.tagId !== undefined) params['tagId'] = String(f.tagId);
  if (f.noTag) params['noTag'] = 'true';
  if (f.minAmount !== undefined) params['minAmount'] = String(f.minAmount);
  if (f.maxAmount !== undefined) params['maxAmount'] = String(f.maxAmount);

  if (state.drill.length) params['drill'] = state.drill.map(encodeStep);
  if (state.period) {
    params['periodStart'] = state.period.start;
    params['periodEnd'] = state.period.end;
    params['periodLabel'] = state.period.label;
  }
  return params;
}

const isValidDate = (value: string): boolean =>
  DATE_PATTERN.test(value) && toLocalDateString(fromLocalDateString(value)) === value;

const asStrings = (value: unknown): string[] =>
  value === undefined || value === null
    ? []
    : Array.isArray(value)
      ? value.map(String)
      : [String(value)];

const one = (value: unknown): string | undefined => asStrings(value)[0];

function parseEnum<T extends string>(
  raw: unknown,
  allowed: T[],
  fallback: T,
  problems: string[],
): T {
  const value: string | undefined = one(raw);
  if (value === undefined) return fallback;
  if (allowed.includes(value as T)) return value as T;
  problems.push(`"${value}" isn't a known setting`);
  return fallback;
}

function parseId(raw: unknown, problems: string[]): number | undefined {
  const value: string | undefined = one(raw);
  if (value === undefined) return undefined;
  if (/^\d+$/.test(value)) return Number(value);
  problems.push(`"${value}" isn't a valid id`);
  return undefined;
}

function parseAmount(raw: unknown, problems: string[]): number | undefined {
  const value: string | undefined = one(raw);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (value.trim() !== '' && Number.isFinite(parsed)) return parsed;
  problems.push(`"${value}" isn't a valid amount`);
  return undefined;
}

function parseStep(entry: string): DrillStep | null {
  const parts: string[] = entry.split('|');
  if (parts.length < 4) return null;
  const [groupBy, filterKey, rawValue] = parts;
  const label: string = parts.slice(3).join('|');
  if (
    !GROUP_BYS.includes(groupBy as GroupBy) ||
    !DRILL_KEYS.includes(filterKey as DrillFilterKey)
  ) {
    return null;
  }
  const key = filterKey as DrillFilterKey;
  let value: number | string | true;
  if (FLAG_KEYS.includes(key)) {
    if (rawValue !== 'true') return null;
    value = true;
  } else if (NUMBER_KEYS.includes(key)) {
    if (!/^\d+$/.test(rawValue)) return null;
    value = Number(rawValue);
  } else {
    if (!rawValue.includes('..')) return null;
    value = rawValue;
  }
  return { groupBy: groupBy as GroupBy, filterKey: key, label, value };
}

function parseDrill(raw: unknown, problems: string[]): DrillStep[] {
  const entries: string[] = asStrings(raw);
  const steps: DrillStep[] = entries.map(parseStep).filter((s): s is DrillStep => s !== null);
  if (steps.length !== entries.length) {
    problems.push("the drill path couldn't be read");
    return [];
  }
  return steps;
}

function parseFilters(params: Params, problems: string[]): ExploreFilters {
  const accountIds: number[] = [];
  asStrings(params['accountIds'])
    .flatMap((v: string): string[] => v.split(','))
    .forEach((part: string): void => {
      if (/^\d+$/.test(part)) accountIds.push(Number(part));
      else problems.push(`"${part}" isn't a valid account`);
    });

  const filters: ExploreFilters = { accountIds };
  const set = <K extends keyof ExploreFilters>(
    key: K,
    value: ExploreFilters[K] | undefined,
  ): void => {
    if (value !== undefined && value !== false && value !== '')
      filters[key] = value as ExploreFilters[K];
  };
  set('categoryId', parseId(params['categoryId'], problems));
  set('categoryName', one(params['categoryName']));
  set('uncategorized', one(params['uncategorized']) === 'true');
  set('merchantId', parseId(params['merchantId'], problems));
  set('merchantName', one(params['merchantName']));
  set('noMerchant', one(params['noMerchant']) === 'true');
  set('tagId', parseId(params['tagId'], problems));
  set('noTag', one(params['noTag']) === 'true');
  set('minAmount', parseAmount(params['minAmount'], problems));
  set('maxAmount', parseAmount(params['maxAmount'], problems));
  return filters;
}

function parsePeriod(params: Params, problems: string[]): Period | null {
  const start: string | undefined = one(params['periodStart']);
  const end: string | undefined = one(params['periodEnd']);
  if (start === undefined && end === undefined) return null;
  if (start && end && isValidDate(start) && isValidDate(end) && start <= end) {
    return { start, end, label: one(params['periodLabel']) ?? 'Selected period' };
  }
  problems.push("the selected period isn't valid");
  return null;
}

/**
 * Reads a state back from URL parameters, tolerating anything: an unknown value or a measure and
 * grouping that don't go together falls back to the default, and `note` says so for the page to show.
 */
export function fromQueryParams(
  params: Params,
  today: Date = new Date(),
): { state: ExploreState; note: string | null } {
  const problems: string[] = [];
  const state: ExploreState = defaultState(today);

  state.measure = parseEnum(params['measure'], MEASURES, 'SPENDING', problems);
  state.groupBy = parseEnum(params['groupBy'], GROUP_BYS, 'CATEGORY', problems);
  if (TIME_ONLY_MEASURES.includes(state.measure) && !TIME_GROUPINGS.includes(state.groupBy)) {
    problems.push(`${state.measure.toLowerCase()} can't be grouped that way`);
    state.measure = 'SPENDING';
    state.groupBy = 'CATEGORY';
  }
  state.side = parseEnum(params['side'], SIDES, 'SPENDING', problems);
  state.compare = parseEnum(params['compare'], COMPARES, 'NONE', problems);
  state.sort = parseEnum(params['sort'], SORTS, 'value', problems);

  const start: string | undefined = one(params['startDate']);
  const end: string | undefined = one(params['endDate']);
  if (start !== undefined || end !== undefined) {
    if (start && end && isValidDate(start) && isValidDate(end) && start <= end) {
      state.startDate = start;
      state.endDate = end;
      state.rangeLabel = one(params['range']) ?? 'Custom';
    } else {
      problems.push("the dates weren't valid, so this year is shown");
    }
  }

  state.filters = parseFilters(params, problems);
  state.drill = parseDrill(params['drill'], problems);
  state.period = parsePeriod(params, problems);
  state.leaf = ['1', 'true'].includes(one(params['leaf']) ?? '');

  const note: string | null = problems.length
    ? `Some settings in this link couldn't be used (${problems.join('; ')}), so the defaults were applied.`
    : null;
  return { state, note };
}

/** The query parameters the explorer endpoints take, by their API names. */
export function toApiParams(state: ExploreState): Record<string, string> {
  const { startDate, endDate } = effectiveDates(state);
  const f: ExploreFilters = state.filters;
  const params: Record<string, string> = {
    measure: state.measure,
    side: state.side,
    groupBy: state.groupBy,
    startDate,
    endDate,
    compare: state.compare,
  };
  if (f.accountIds.length) params['accountIds'] = f.accountIds.join(',');
  if (f.categoryId !== undefined) params['categoryId'] = String(f.categoryId);
  if (f.uncategorized) params['uncategorized'] = 'true';
  if (f.merchantId !== undefined) params['merchantId'] = String(f.merchantId);
  if (f.noMerchant) params['noMerchant'] = 'true';
  if (f.tagId !== undefined) params['tagId'] = String(f.tagId);
  if (f.noTag) params['noTag'] = 'true';
  if (f.minAmount !== undefined) params['minAmount'] = String(f.minAmount);
  if (f.maxAmount !== undefined) params['maxAmount'] = String(f.maxAmount);
  return params;
}
