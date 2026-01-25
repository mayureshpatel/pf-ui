export interface DashboardData {
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  categoryBreakdown: CategoryTotal[];
}

export interface DashboardPulse {
  currentIncome: number;
  previousIncome: number;
  currentExpense: number;
  previousExpense: number;
  currentSavingsRate: number;
  previousSavingsRate: number;
}

export interface CashFlowTrend {
  month: number;
  year: number;
  income: number;
  expense: number;
}

export interface YtdSummary {
  year: number;
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  avgSavingsRate: number;
}

export enum ActionType {
  TRANSFER_REVIEW = 'TRANSFER_REVIEW',
  UNCATEGORIZED = 'UNCATEGORIZED',
  STALE_DATA = 'STALE_DATA'
}

export interface ActionItem {
  type: ActionType;
  count: number;
  message: string;
  route?: string;
}

export interface CategoryTotal {
  categoryName: string;
  total: number;
  icon?: string;
  color?: string;
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
