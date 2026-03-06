import {Category} from '@models/category.model';

/**
 * Represents a budget object.
 *
 * Maps directly to the Budget entity in the database, without audit fields.
 *
 * @property id - The unique identifier of the budget.
 * @property userId - The ID of the user associated with the budget.
 * @property category - The {@link Category} associated with the budget.
 * @property amount - The amount of the budget.
 * @property month - The month of the budget (1-12).
 * @property year - The year of the budget.
 */
export interface Budget {
  id: number;
  userId: number;
  category: Category;
  amount: number;
  month: number;
  year: number;
}

/**
 * Represents a request to create a new budget.
 *
 * @property userId - The ID of the user creating the budget.
 * @property categoryId - The ID of the category for the budget.
 * @property amount - The amount of the budget.
 * @property month - The month of the budget (1-12).
 * @property year - The year of the budget.
 */
export interface BudgetCreateRequest {
  userId: number;
  categoryId: number;
  amount: number;
  month: number;
  year: number;
}

/**
 * Represents a request to update an existing budget.
 *
 * @property id - The ID of the budget to update.
 * @property userId - The ID of the user updating the budget.
 * @property amount - The new amount for the budget.
 */
export interface BudgetUpdateRequest {
  id: number;
  userId: number;
  amount: number;
}

/**
 * Represents the status of a budget.
 *
 * A budget status is a summary of the budgeted, spent, and remaining amount for a specific category.
 *
 * @property category - The {@link Category} associated with the budget status.
 * @property budgetedAmount - The total budgeted amount for the category.
 * @property spentAmount - The total amount spent on the category.
 * @property remainingAmount - The remaining budget for the category.
 * @property percentageUsed - The percentage of the budget used.
 */
export interface BudgetStatus {
  category: Category;
  budgetedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentageUsed: number;
}
