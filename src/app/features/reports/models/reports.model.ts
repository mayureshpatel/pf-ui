// ---- Net worth (PF-887) ----

export type NetWorthMeasure = 'NET_WORTH' | 'ASSETS' | 'DEBTS';
export type NetWorthCompareMode = 'NONE' | 'YEAR_AGO' | 'PREVIOUS_PERIOD';

/** Net worth at one month end. Field names match `NetWorthPointDto`; `debts` is the amount owed, positive. */
export interface NetWorthPoint {
  date: string; // ISO date (YYYY-MM-DD), the month end
  assets: number;
  debts: number;
  netWorth: number;
  partial: boolean;
}

/** What happened in one account over the range (`NetWorthStoryDto`). */
export interface NetWorthStory {
  openingBalance: number;
  closingBalance: number;
  deposits: number;
  withdrawals: number;
  interestAndAdjustments: number;
}

/** One row: an account type or an account (`NetWorthGroupDto`). Balances are raw and signed. */
export interface NetWorthGroup {
  key: string;
  label: string;
  kind: 'ASSET' | 'DEBT';
  typeCode: string;
  accountCount: number;
  balance: number;
  previousBalance: number;
  comparisonBalance: number | null;
  series: (number | null)[];
  story: NetWorthStory | null;
}

export interface NetWorthSummary {
  netWorth: number;
  assets: number;
  debts: number;
  liquidCash: number;
  averageMonthlySpending: number;
  monthsCovered: number | null;
}

export interface NetWorthMoved {
  change: number;
  saved: number;
  other: number;
}

export interface NetWorthComparison {
  label: string;
  start: string;
  end: string;
  netWorth: number;
  assets: number;
  debts: number;
}

/** Everything the net worth view shows (`NetWorthBreakdownDto`). */
export interface NetWorthBreakdown {
  points: NetWorthPoint[];
  opening: NetWorthPoint;
  asOf: string;
  summary: NetWorthSummary;
  moved: NetWorthMoved;
  comparison: NetWorthComparison | null;
  groups: NetWorthGroup[];
}

// ---- The explorer (PF-886) ----

export type Measure = 'SPENDING' | 'INCOME' | 'NET' | 'SAVINGS_RATE' | 'COUNT' | 'AVERAGE';
export type Side = 'SPENDING' | 'INCOME';
export type GroupBy =
  | 'CATEGORY'
  | 'SUBCATEGORY'
  | 'MERCHANT'
  | 'ACCOUNT'
  | 'TAG'
  | 'MONTH'
  | 'WEEK'
  | 'DAY_OF_WEEK'
  | 'DAY';
export type Compare = 'NONE' | 'PREVIOUS_PERIOD' | 'SAME_DAYS_LAST_YEAR';
export type SortKey = 'value' | 'change' | 'name' | 'count';

/** The stacked filters. Names ride along with the ids so links can be built without a lookup. */
export interface ExploreFilters {
  accountIds: number[];
  categoryId?: number;
  categoryName?: string;
  uncategorized?: boolean;
  merchantId?: number;
  merchantName?: string;
  noMerchant?: boolean;
  tagId?: number;
  noTag?: boolean;
  minAmount?: number;
  maxAmount?: number;
}

/** A date window narrower than the range, set by drilling into a month, week or day (or a trend bar). */
export interface Period {
  start: string; // yyyy-MM-dd
  end: string; // yyyy-MM-dd, inclusive
  label: string;
}

export type DrillFilterKey =
  | 'categoryId'
  | 'uncategorized'
  | 'merchantId'
  | 'noMerchant'
  | 'accountIds'
  | 'tagId'
  | 'noTag'
  | 'period';

/**
 * One click of the drill: the grouping it was made in, the filter it added and its value (an id, `true`
 * for the "none" rows, or `start..end` for a period), and how it reads in the breadcrumb. Stepping back
 * restores each filter from an earlier step on the same key, or clears it.
 */
export interface DrillStep {
  groupBy: GroupBy;
  filterKey: DrillFilterKey;
  label: string;
  value: number | string | true;
  /** What the filters this step touched held before it, so stepping back can put them back. */
  before?: Partial<ExploreFilters>;
}

export interface ExploreState {
  measure: Measure;
  side: Side;
  groupBy: GroupBy;
  startDate: string;
  endDate: string;
  rangeLabel: string;
  compare: Compare;
  sort: SortKey;
  filters: ExploreFilters;
  drill: DrillStep[];
  /** Show the transactions behind the number instead of groups. */
  leaf: boolean;
  period: Period | null;
}

export interface ExploreRow {
  key: string | null;
  label: string;
  value: number | null;
  comparisonValue: number | null;
  count: number;
}

export interface ExploreResult {
  rows: ExploreRow[];
  total: number | null;
  comparisonTotal: number | null;
  totalCount: number;
  excludedCount: number;
  comparisonStart: string | null;
  comparisonEnd: string | null;
  comparisonLabel: string | null;
  inProgress: boolean;
}

export interface TrendBucket {
  start: string;
  value: number | null;
  partial: boolean;
}

export interface ExploreTrend {
  current: TrendBucket[];
  comparison: TrendBucket[];
}

export interface ExploreTransaction {
  id: number;
  date: string;
  description: string | null;
  merchantName: string | null;
  accountName: string;
  categoryName: string | null;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
}
