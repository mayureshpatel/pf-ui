export interface DateRange {
  startDate: string; // ISO date (YYYY-MM-DD)
  endDate: string;
  label?: string;
}

export interface CategoryReportData {
  categoryName: string;
  total: number;
  count: number;
  avgTransaction: number;
  color?: string;
}

export interface VendorReportData {
  vendorName: string;
  total: number;
  count: number;
  categories: string[];
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
