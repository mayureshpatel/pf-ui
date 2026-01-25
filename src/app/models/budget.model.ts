export interface Budget {
  id: number;
  categoryId: number;
  categoryName: string;
  amount: number;
  month: number;
  year: number;
}

export interface BudgetDto {
  categoryId: number;
  amount: number;
  month: number;
  year: number;
}

export interface BudgetStatus {
  categoryId?: number;
  categoryName: string;
  budgetedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentageUsed: number;
}
