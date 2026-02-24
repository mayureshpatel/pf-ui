import {User} from '@models/auth.model';
import {Category} from '@models/category.model';

export interface Budget {
  id: number;
  user: User;
  category: Category;
  amount: number;
  month: number;
  year: number;
}

export interface BudgetStatus {
  category: Category;
  budgetedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentageUsed: number;
}
