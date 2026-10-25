import { Params } from '@angular/router';
import { fromLocalDateString, toLocalDateString } from '@shared/utils/transaction.utils';
import {
  Compare,
  DrillFilterKey,
  DrillStep,
  ExploreFilters,
  ExploreRow,
  ExploreState,
  GroupBy,
  Measure,
  Period,
} from '../models/reports.model';
import { effectiveDates, TIME_GROUPINGS, TIME_ONLY_MEASURES } from './explore-state';

export const OTHER_KEY = '__other__';

export const MEASURE_LABELS: Record<Measure, string> = {
  SPENDING: 'Spending',
  INCOME: 'Income',
  NET: 'Net',
  SAVINGS_RATE: 'Savings rate',
  COUNT: 'Count',
  AVERAGE: 'Average',
};

export const GROUP_LABELS: Record<GroupBy, string> = {
  CATEGORY: 'Category',
  SUBCATEGORY: 'Subcategory',
  MERCHANT: 'Merchant',
  ACCOUNT: 'Account',
  TAG: 'Tag',
  MONTH: 'Month',
  WEEK: 'Week',
  DAY_OF_WEEK: 'Day of week',
  DAY: 'Day',
};

export const COMPARE_LABELS: Record<Compare, string> = {
  NONE: 'No comparison',
  PREVIOUS_PERIOD: 'Previous period',
  SAME_DAYS_LAST_YEAR: 'Same days last year',
};

const NET_REASON = 'Net is income minus spending, so it only makes sense over time.';
const SAVINGS_RATE_REASON =
  'Savings rate compares income with spending, so it only makes sense over time.';
const TRANSACTIONS_PAGE = "The Transactions page can't";

/** Whether a measure can be grouped a given way, and if not, why (shown as the option's tooltip). */
export function isAllowed(measure: Measure, groupBy: GroupBy): { ok: boolean; reason?: string } {
  if (TIME_ONLY_MEASURES.includes(measure) && !TIME_GROUPINGS.includes(groupBy)) {
    return { ok: false, reason: measure === 'NET' ? NET_REASON : SAVINGS_RATE_REASON };
  }
  return { ok: true };
}

/** The API has no day-of-week filter, so those rows can't be drilled into. */
export const isDrillable = (groupBy: GroupBy): boolean => groupBy !== 'DAY_OF_WEEK';

/**
 * Where a click on a row leads: Category -> Subcategory -> Merchant -> Transactions, and from every
 * other grouping Category -> Transactions. The drill so far decides, so a path that started elsewhere
 * (Merchant -> Category) doesn't wander back through subcategories or offer a merchant twice.
 */
export function nextGrouping(groupBy: GroupBy, drill: DrillStep[] = []): GroupBy | 'TRANSACTIONS' {
  const has = (groupings: GroupBy[]): boolean => drill.some((s) => groupings.includes(s.groupBy));
  switch (groupBy) {
    case 'CATEGORY':
      return has(['MERCHANT', 'ACCOUNT', 'TAG', 'MONTH', 'WEEK', 'DAY_OF_WEEK', 'DAY'])
        ? 'TRANSACTIONS'
        : 'SUBCATEGORY';
    case 'SUBCATEGORY':
      return has(['MERCHANT']) ? 'TRANSACTIONS' : 'MERCHANT';
    default:
      return has(['CATEGORY', 'SUBCATEGORY']) ? 'TRANSACTIONS' : 'CATEGORY';
  }
}

const addDays = (date: string, days: number): string => {
  const d: Date = fromLocalDateString(date);
  return toLocalDateString(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
};

const lastDayOfMonth = (date: string): string => {
  const d: Date = fromLocalDateString(date);
  return toLocalDateString(new Date(d.getFullYear(), d.getMonth() + 1, 0));
};

const parsePeriodValue = (step: DrillStep): Period => {
  const [start, end] = String(step.value).split('..');
  return { start, end, label: step.label };
};

/** The window a month, week or day row stands for, kept inside the range (and period) already chosen. */
function periodOf(state: ExploreState, key: string, label: string): Period {
  const bounds = effectiveDates(state);
  const rowEnd: string =
    state.groupBy === 'MONTH'
      ? lastDayOfMonth(key)
      : state.groupBy === 'WEEK'
        ? addDays(key, 6)
        : key;
  return {
    start: key > bounds.startDate ? key : bounds.startDate,
    end: rowEnd < bounds.endDate ? rowEnd : bounds.endDate,
    label,
  };
}

interface Applied {
  filters: ExploreFilters;
  period: Period | null;
  step: DrillStep;
}

function applyRow(state: ExploreState, row: ExploreRow): Applied {
  const filters: ExploreFilters = { ...state.filters };
  let period: Period | null = state.period;
  const groupBy: GroupBy = state.groupBy;
  const id: number | null = row.key === null ? null : Number(row.key);
  const step = (filterKey: DrillFilterKey, value: DrillStep['value']): DrillStep => ({
    groupBy,
    filterKey,
    label: row.label,
    value,
  });

  switch (groupBy) {
    case 'CATEGORY':
    case 'SUBCATEGORY':
      if (id === null) {
        filters.uncategorized = true;
        return { filters, period, step: step('uncategorized', true) };
      }
      filters.categoryId = id;
      filters.categoryName = row.label;
      return { filters, period, step: step('categoryId', id) };
    case 'MERCHANT':
      if (id === null) {
        filters.noMerchant = true;
        return { filters, period, step: step('noMerchant', true) };
      }
      filters.merchantId = id;
      filters.merchantName = row.label;
      return { filters, period, step: step('merchantId', id) };
    case 'ACCOUNT':
      filters.accountIds = [id as number];
      return { filters, period, step: step('accountIds', id as number) };
    case 'TAG':
      if (id === null) {
        filters.noTag = true;
        return { filters, period, step: step('noTag', true) };
      }
      filters.tagId = id;
      return { filters, period, step: step('tagId', id) };
    default: {
      period = periodOf(state, row.key as string, row.label);
      return { filters, period, step: step('period', `${period.start}..${period.end}`) };
    }
  }
}

type RowMode = 'drill' | 'filter' | 'transactions';

function applyMode(state: ExploreState, row: ExploreRow, mode: RowMode): ExploreState {
  if (!isDrillable(state.groupBy)) return state;
  const { filters, period, step } = applyRow(state, row);
  const drillAfter: DrillStep[] = [...state.drill, step];
  // an uncategorized row has no subcategories to look at, so it goes straight to merchants
  const from: GroupBy = step.filterKey === 'uncategorized' ? 'SUBCATEGORY' : state.groupBy;
  const next: GroupBy | 'TRANSACTIONS' | null =
    mode === 'drill' ? nextGrouping(from, drillAfter) : null;
  return {
    ...state,
    filters,
    period,
    drill: drillAfter,
    groupBy: next && next !== 'TRANSACTIONS' ? next : state.groupBy,
    leaf: mode === 'transactions' || next === 'TRANSACTIONS',
  };
}

/** Click a row: filter to it and move to the next grouping (or to the transactions). */
export const drill = (state: ExploreState, row: ExploreRow): ExploreState =>
  applyMode(state, row, 'drill');

/** "Filter to X and keep grouping": add the row's filter without changing the grouping. */
export const filterOnly = (state: ExploreState, row: ExploreRow): ExploreState =>
  applyMode(state, row, 'filter');

/** "Open transactions": filter to the row and list the transactions behind it. */
export const openTransactions = (state: ExploreState, row: ExploreRow): ExploreState =>
  applyMode(state, row, 'transactions');

function restore(filters: ExploreFilters, key: DrillFilterKey, kept: DrillStep[]): void {
  const last: DrillStep | undefined = [...kept].reverse().find((s) => s.filterKey === key);
  switch (key) {
    case 'categoryId':
      filters.categoryId = last ? (last.value as number) : undefined;
      filters.categoryName = last?.label;
      break;
    case 'merchantId':
      filters.merchantId = last ? (last.value as number) : undefined;
      filters.merchantName = last?.label;
      break;
    case 'accountIds':
      filters.accountIds = last ? [last.value as number] : [];
      break;
    case 'tagId':
      filters.tagId = last ? (last.value as number) : undefined;
      break;
    case 'uncategorized':
    case 'noMerchant':
    case 'noTag':
      filters[key] = last ? true : undefined;
      break;
    default:
      break;
  }
}

/**
 * Goes back to the crumb at `index` (0 is the start): the later steps go, the filters they added are
 * restored from earlier steps or cleared, and the grouping returns to the one the first removed step
 * was made in. Filters added from the menu rather than by drilling are untouched.
 */
export function stepBack(state: ExploreState, index: number): ExploreState {
  if (index < 0 || index >= state.drill.length) return state;
  const kept: DrillStep[] = state.drill.slice(0, index);
  const removed: DrillStep[] = state.drill.slice(index);
  const filters: ExploreFilters = { ...state.filters };
  new Set(removed.map((s) => s.filterKey)).forEach((key) => restore(filters, key, kept));
  const lastPeriod: DrillStep | undefined = [...kept]
    .reverse()
    .find((s) => s.filterKey === 'period');
  const period: Period | null = removed.some((s) => s.filterKey === 'period')
    ? lastPeriod
      ? parsePeriodValue(lastPeriod)
      : null
    : state.period;
  return { ...state, filters, period, drill: kept, groupBy: removed[0].groupBy, leaf: false };
}

export type Polarity = 'up-bad' | 'up-good' | 'neutral';
export type Tone = 'good' | 'bad' | 'neutral';

/** Whether a rise in the measure is bad news (spending), good news (income, net) or no judgement. */
export function polarity(measure: Measure): Polarity {
  switch (measure) {
    case 'SPENDING':
      return 'up-bad';
    case 'INCOME':
    case 'NET':
    case 'SAVINGS_RATE':
      return 'up-good';
    default:
      return 'neutral';
  }
}

const trimmed = (n: number): string => String(Number(Math.abs(n).toFixed(1)));

/**
 * The change against the comparison as words with an arrow (never colour alone) and the tone to colour
 * it. Savings rate changes are in points, since a percentage of a percentage misleads.
 */
export function changeText(
  value: number | null | undefined,
  comparison: number | null | undefined,
  measure: Measure,
): { text: string; tone: Tone } {
  const none = { text: '', tone: 'neutral' as Tone };
  if (value === null || value === undefined || comparison === null || comparison === undefined) {
    return none;
  }
  const unchanged = { text: 'no change', tone: 'neutral' as Tone };
  let change: number;
  let suffix: string;
  if (measure === 'SAVINGS_RATE') {
    change = value - comparison;
    suffix = ' pts';
  } else if (comparison === 0) {
    return value === 0 ? unchanged : { text: 'new', tone: 'neutral' };
  } else {
    change = ((value - comparison) / Math.abs(comparison)) * 100;
    suffix = '%';
  }
  if (Math.abs(change) < 0.05) return unchanged;
  const up: boolean = change > 0;
  const rule: Polarity = polarity(measure);
  const tone: Tone = rule === 'neutral' ? 'neutral' : up === (rule === 'up-good') ? 'good' : 'bad';
  return { text: `${up ? '▲ up' : '▼ down'} ${trimmed(change)}${suffix}`, tone };
}

export interface TopRows {
  rows: ExploreRow[];
  other: ExploreRow | null;
  /** How many rows lie beyond the first `n` (still counted when Other is expanded, for "show fewer"). */
  hiddenCount: number;
}

/**
 * The first `n` rows with the rest folded into one "Other (N more)" row (last), unless expanded. The
 * "none" rows (Uncategorized, No merchant, No tag) always stay visible. `additive` says whether the
 * measure can be summed; if not (savings rate, average) Other has no value of its own.
 */
export function topWithOther(
  rows: ExploreRow[],
  n = 10,
  expandedOther = false,
  additive = true,
): TopRows {
  const hidden: ExploreRow[] = rows.filter((r, i) => i >= n && r.key !== null);
  if (hidden.length === 0) return { rows, other: null, hiddenCount: 0 };
  if (expandedOther) return { rows, other: null, hiddenCount: hidden.length };

  const sum = (pick: (r: ExploreRow) => number | null): number | null =>
    additive && hidden.every((r) => pick(r) !== null)
      ? hidden.reduce((total, r) => total + (pick(r) as number), 0)
      : null;
  return {
    rows: rows.filter((r, i) => i < n || r.key === null),
    other: {
      key: OTHER_KEY,
      label: `Other (${hidden.length} more)`,
      value: sum((r) => r.value),
      comparisonValue: sum((r) => r.comparisonValue),
      count: hidden.reduce((total, r) => total + r.count, 0),
    },
    hiddenCount: hidden.length,
  };
}

/** Whether the filters fit the Transactions page (one account, one category, one merchant, one tag). */
export function isTransactionsLinkable(
  filters: ExploreFilters,
  measure?: Measure,
): { ok: boolean; reason?: string } {
  const no = (reason: string): { ok: boolean; reason: string } => ({
    ok: false,
    reason: `${TRANSACTIONS_PAGE} ${reason}.`,
  });
  if (filters.accountIds.length > 1) return no('show several accounts at once');
  if (filters.uncategorized) return no('show only uncategorized transactions');
  if (filters.noMerchant) return no('show only transactions without a merchant');
  if (filters.noTag) return no('show only transactions without a tag');
  if (measure === 'NET' || measure === 'SAVINGS_RATE')
    return no('show income and spending together');
  if (
    (filters.categoryId !== undefined && !filters.categoryName) ||
    (filters.merchantId !== undefined && !filters.merchantName)
  ) {
    return no('open a category or merchant it has no name for');
  }
  return { ok: true };
}

/** The Transactions page's URL parameters for the state, or null when the filters don't fit it. */
export function toTransactionsQuery(state: ExploreState): Params | null {
  if (!isTransactionsLinkable(state.filters, state.measure).ok) return null;
  const f: ExploreFilters = state.filters;
  const income: boolean =
    state.measure === 'INCOME' ||
    ((state.measure === 'COUNT' || state.measure === 'AVERAGE') && state.side === 'INCOME');
  const { startDate, endDate } = effectiveDates(state);
  const query: Params = { type: income ? 'INCOME' : 'EXPENSE', startDate, endDate };
  if (f.accountIds.length === 1) query['accountId'] = String(f.accountIds[0]);
  if (f.merchantName) query['merchant'] = f.merchantName;
  if (f.categoryName) query['categoryName'] = f.categoryName;
  if (f.tagId !== undefined) query['tagId'] = String(f.tagId);
  if (f.minAmount !== undefined) query['minAmount'] = String(f.minAmount);
  if (f.maxAmount !== undefined) query['maxAmount'] = String(f.maxAmount);
  return query;
}

export interface StartView {
  key: string;
  label: string;
  state: Partial<ExploreState>;
}

/** Saved control settings, not separate reports. */
export const startViews: StartView[] = [
  {
    key: 'top-merchants',
    label: 'Top merchants',
    state: { measure: 'SPENDING', groupBy: 'MERCHANT' },
  },
  {
    key: 'monthly-cash-flow',
    label: 'Monthly cash flow',
    state: { measure: 'NET', groupBy: 'MONTH', compare: 'PREVIOUS_PERIOD' },
  },
  {
    key: 'biggest-movers',
    label: 'Biggest movers',
    state: {
      measure: 'SPENDING',
      groupBy: 'CATEGORY',
      compare: 'SAME_DAYS_LAST_YEAR',
      sort: 'change',
    },
  },
  {
    key: 'uncategorized',
    label: 'Uncategorized',
    state: {
      measure: 'SPENDING',
      groupBy: 'MERCHANT',
      filters: { accountIds: [], uncategorized: true },
    },
  },
];

/** Applies a start view on top of the current range, clearing the drill, filters and comparison. */
export function applyStartView(state: ExploreState, view: StartView): ExploreState {
  return {
    ...state,
    measure: 'SPENDING',
    side: 'SPENDING',
    groupBy: 'CATEGORY',
    compare: 'NONE',
    sort: 'value',
    ...view.state,
    filters: { accountIds: [], ...view.state.filters },
    drill: [],
    leaf: false,
    period: null,
  };
}

export interface RangePreset {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
}

/** The date range presets with their real dates; "All time" starts at the year 2000. */
export function rangePresets(today: Date = new Date()): RangePreset[] {
  const y: number = today.getFullYear();
  const m: number = today.getMonth();
  const d: number = today.getDate();
  const quarterStart: number = Math.floor(m / 3) * 3;
  const preset = (key: string, label: string, start: Date, end: Date): RangePreset => ({
    key,
    label,
    startDate: toLocalDateString(start),
    endDate: toLocalDateString(end),
  });
  return [
    preset('this-month', 'This month', new Date(y, m, 1), new Date(y, m + 1, 0)),
    preset('last-month', 'Last month', new Date(y, m - 1, 1), new Date(y, m, 0)),
    preset(
      'this-quarter',
      'This quarter',
      new Date(y, quarterStart, 1),
      new Date(y, quarterStart + 3, 0),
    ),
    preset('this-year', 'This year', new Date(y, 0, 1), new Date(y, 11, 31)),
    preset('last-12-months', 'Last 12 months', new Date(y - 1, m, d + 1), today),
    preset('all-time', 'All time', new Date(2000, 0, 1), today),
  ];
}

const MONEY = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const WHOLE = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** A measure's value for display: dollars, a percentage for the savings rate, a count, or a dash when empty. */
export function formatMeasure(measure: Measure, value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  switch (measure) {
    case 'SAVINGS_RATE':
      return `${trimmed(value).replace(/^/, value < 0 ? '-' : '')}%`;
    case 'COUNT':
      return WHOLE.format(value);
    default:
      return MONEY.format(value);
  }
}

/** Whether the measure's per-row values can be added up (a rate or an average cannot). */
export const isAdditive = (measure: Measure): boolean =>
  measure !== 'SAVINGS_RATE' && measure !== 'AVERAGE';

export type Granularity = 'day' | 'week' | 'month';

/** Day, week or month buckets, read off the spacing of the first two bucket starts. */
export function granularityOf(starts: string[]): Granularity {
  if (starts.length < 2) {
    return starts.length === 1 && !starts[0].endsWith('-01') ? 'day' : 'month';
  }
  const gap: number =
    (fromLocalDateString(starts[1]).getTime() - fromLocalDateString(starts[0]).getTime()) /
    86_400_000;
  return gap <= 1 ? 'day' : gap <= 7 ? 'week' : 'month';
}

/** A bucket's name: "Mar 12", "Week of Mar 9" or "Mar 2026". */
export function bucketLabel(start: string, granularity: Granularity): string {
  const date: Date = fromLocalDateString(start);
  const format = (options: Intl.DateTimeFormatOptions): string =>
    date.toLocaleDateString('en-US', options);
  switch (granularity) {
    case 'day':
      return format({ month: 'short', day: 'numeric' });
    case 'week':
      return `Week of ${format({ month: 'short', day: 'numeric' })}`;
    default:
      return format({ month: 'short', year: 'numeric' });
  }
}
