import { Category } from '@models/category.model';
import { Merchant } from '@models/merchant.model';

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
 * Aggregated data for merchant-based reporting.
 */
export interface MerchantReportData {
  merchant: Merchant;
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
