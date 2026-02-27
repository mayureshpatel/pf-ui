import {Category} from '@models/category.model';
import {Merchant} from '@models/merchant.model';

export interface DateRange {
  startDate: string; // ISO date (YYYY-MM-DD)
  endDate: string;
  label?: string;
}

export interface CategoryReportData {
  category: Category;
  total: number;
  count: number;
  avgTransaction: number;
}

export interface VendorReportData {
  merchant: Merchant;
  total: number;
  count: number;
  categories: Category[];
}

export interface MonthlyReportData {
  month: string;      // "YYYY-MM" format
  income: number;
  expense: number;
  netSavings: number;
}

export interface DateRangePreset {
  label: string;
  getValue: () => DateRange;
}
