import { Category } from '@models/category.model';

/**
 * Represents a date range filter.
 */
export interface DateRange {
  startDate: string; // ISO date (YYYY-MM-DD)
  endDate: string;
  label?: string;
}

/**
 * Aggregated data for category-based reporting.
 */
export interface CategoryReportData {
  category: Category;
  total: number;
  count: number;
  avgTransaction: number;
}

/**
 * Aggregated data for merchant-based reporting (PF-841). Merchants deliberately sharing one clean
 * name are aggregated server-side into one row, so this no longer nests a single `Merchant` --
 * `representativeMerchantId` is only a stable key/track-by id, not "the" merchant.
 */
export interface MerchantReportData {
  representativeMerchantId: number;
  displayName: string;
  total: number;
  count: number;
  categories: string[];
}

/**
 * Aggregated data for monthly trend reporting.
 */
export interface MonthlyReportData {
  month: string; // "YYYY-MM" format
  income: number;
  expense: number;
  netSavings: number;
}

/**
 * Configuration for a date range preset.
 */
export interface DateRangePreset {
  label: string;
  getValue: () => DateRange;
}

/**
 * A single point in a net-worth-over-time series (PF-304's backend-computed report), one per
 * month-end in the requested range. Field names match `NetWorthDataPointDto` exactly.
 */
export interface NetWorthDataPoint {
  date: string; // ISO date (YYYY-MM-DD), the end-of-month this point represents
  netWorth: number;
}

// ---- The explorer (PF-886). The members above stay until the old tabs are removed. ----

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
