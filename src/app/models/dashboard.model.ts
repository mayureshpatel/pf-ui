import {Category} from '@models/category.model';
import {Merchant} from '@models/merchant.model';

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
  category: Category;
  total: number;
}

export interface MerchantBreakdown {
  merchant: Merchant;
  total: number;
}

export interface DailyBalance {
  date: string;
  balance: number;
}

export interface MonthOption {
  label: string;
  value: number;
}

export interface YearOption {
  label: string;
  value: number;
}
