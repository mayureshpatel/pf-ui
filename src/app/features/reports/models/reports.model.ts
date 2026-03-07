import {Category} from '@models/category.model';
import {Merchant} from '@models/merchant.model';

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
 * Aggregated data for vendor-based reporting.
 */
export interface VendorReportData {
  merchant: Merchant;
  total: number;
  count: number;
  categories: string[];
}

/**
 * Aggregated data for monthly trend reporting.
 */
export interface MonthlyReportData {
  month: string;      // "YYYY-MM" format
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
