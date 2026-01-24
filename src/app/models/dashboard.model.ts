export interface DashboardData {
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  categoryBreakdown: CategoryTotal[];
}

export interface CategoryTotal {
  categoryName: string;
  total: number;
}

export interface DailyBalance {
  date: string; // LocalDate from backend
  balance: number;
}

export interface MonthOption {
  label: string;
  value: number; // 1-12
}

export interface YearOption {
  label: string;
  value: number;
}
