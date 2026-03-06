/**
 * Represents a category object.
 *
 * Maps directly to the Category entity in the database, without audit fields.
 *
 * @property id - The unique identifier of the category.
 * @property userId - The ID of the user associated with the category.
 * @property name - The name of the category.
 * @property type - The {@link CategoryType} of (income, expense, both, or transfer).
 * @property parent - The parent category, if any.
 * @property icon - The icon associated with the category.
 * @property color - The color associated with the category.
 */
export interface Category {
  id: number;
  userId: number;
  name: string;
  type: CategoryType;
  parent: Category | null;
  icon: string;
  color: string;
}

/**
 * Represents a category type enum as defined in the backend.
 *
 * @enum {string}
 */
export enum CategoryType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  BOTH = 'BOTH',
  TRANSFER = 'TRANSFER',
}

/**
 * Represents a request to create a new category.
 *
 * @property userId - The ID of the user creating the category.
 * @property name - The name of the category.
 * @property type - The type of the category (income, expense, both, or transfer).
 * @property icon - The icon associated with the category.
 * @property color - The color associated with the category.
 * @property parentId - The ID of the parent category, if any.
 */
export interface CategoryCreateRequest {
  userId: number;
  name: string;
  type: string;
  icon: string;
  color: string;
  parentId?: number;
}

/**
 * Represents a request to update an existing category.
 *
 * @property id - The ID of the category to update.
 * @property userId - The ID of the user updating the category.
 * @property name - The new name of the category.
 * @property type - The new type of the category (income, expense, both, or transfer).
 * @property icon - The new icon associated with the category.
 * @property color - The new color associated with the category.
 * @property parentId - The ID of the new parent category, if any.
 */
export interface CategoryUpdateRequest {
  id: number;
  userId: number;
  name: string;
  type: string;
  color: string;
  icon: string;
  parentId?: number;
}

/**
 * Represents a category with the number of transactions it is associated with.
 *
 * @property transactionCount - The number of transactions associated with the category.
 * @extends Category
 *
 */
export interface CategoryTransactionCount extends Category {
  transactionCount: number;
}

/**
 * Represents a category view model with additional usage information.
 *
 * @property groupName - The name of the group the category belongs to.
 * @property budgetedAmount - The budgeted amount for the category, if any.
 * @property remainingAmount - The remaining amount for the category, if any.
 * @property percentageUsed - The percentage of the budget used by the category, if any.
 * @extends CategoryTransactionCount
 */
export interface CategoryBudgetGroup extends CategoryTransactionCount {
  groupName: string;
  budgetedAmount?: number;
  remainingAmount?: number;
  percentageUsed?: number;
}

/**
 * Represents a parent category and all its child categories; where the group id and name
 * are the parent category id and name.
 *
 * @property groupLabel - The label of the group the parent category belongs to.
 * @property groupId - The ID of the parent category.
 * @property items - The list of child categories of the parent category.
 */
export interface CategoryGroup {
  groupLabel: string;
  groupId: number;
  items: Category[];
}
