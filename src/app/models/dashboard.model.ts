import {Category} from '@models/category.model';
import {Merchant} from '@models/merchant.model';

/**
 * Represents the type of action available on the dashboard.
 *
 * @enum {string}
 */
export enum ActionType {
  TRANSFER_REVIEW = 'TRANSFER_REVIEW',
  UNCATEGORIZED = 'UNCATEGORIZED',
  STALE_DATA = 'STALE_DATA',
}

/**
 * Represents an action item for the dashboard.
 *
 * @property type - The type of action.
 * @property count - The number of items of this type.
 * @property message - A message describing the action.
 * @property route - The route to navigate to when the action is performed.
 */
export interface ActionItem {
  type: ActionType;
  count: number;
  message: string;
  route?: string;
}

/**
 * Represents the data needed to display the dashboard.
 *
 * @property totalIncome - The total income.
 * @property totalExpense - The total expense.
 * @property netSavings - The net savings.
 * @property categoryBreakdown - The category breakdown.
 */
export interface DashboardData {
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  categoryBreakdown: CategoryBreakdown[];
}

/**
 * Represents the pulse of the dashboard, showing current and previous financial metrics.
 *
 * @property currentIncome - The current income.
 * @property previousIncome - The previous income.
 * @property currentExpense - The current expense.
 * @property previousExpense - The previous expense.
 * @property currentSavingsRate - The current savings rate.
 * @property previousSavingsRate - The previous savings rate.
 */
export interface DashboardPulse {
  currentIncome: number;
  previousIncome: number;
  currentExpense: number;
  previousExpense: number;
  currentSavingsRate: number;
  previousSavingsRate: number;
}

/**
 * Represents a trend in cash flow over time.
 *
 * @property month - The month for the trend.
 * @property year - The year for the trend.
 * @property income - The income for the month.
 * @property expense - The expense for the month.
 */
export interface CashFlowTrend {
  month: number;
  year: number;
  income: number;
  expense: number;
}

/**
 * Represents a summary of the year-to-date transactions.
 *
 * @property year - The year for the summary.
 * @property totalIncome - The total income for the year.
 * @property totalExpense - The total expense for the year.
 * @property netSavings - The net savings for the year.
 * @property avgSavingsRate - The average savings rate for the year.
 */
export interface YtdSummary {
  year: number;
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  avgSavingsRate: number;
}

/**
 * Represents a category breakdown.
 *
 * @property category - The category.
 * @property total - The total amount spent in the category.
 */
export interface CategoryBreakdown {
  category: Category;
  total: number;
}

/**
 * Represents a merchant breakdown.
 *
 * @property merchant - The merchant.
 * @property total - The total amount spent on the merchant.
 */
export interface MerchantBreakdown {
  merchant: Merchant;
  total: number;
}

/**
 * Represents a month and year option for filtering.
 *
 * @property label - The label to display for the option.
 * @property value - The value to use for filtering.
 */
export interface MonthOption {
  label: string;
  value: number;
}

/**
 * Represents a year option for filtering.
 *
 * @property label - The label to display for the option.
 * @property value - The value to use for filtering.
 */
export interface YearOption {
  label: string;
  value: number;
}
