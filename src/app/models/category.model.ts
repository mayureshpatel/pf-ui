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
 * @property transactionCount - The number of transactions associated with the category, if any.
 */
export interface Category {
  id: number;
  userId: number;
  name: string;
  type: CategoryType;
  parent: Category | null;
  icon: string;
  color: string;

  transactionCount?: number;
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
 * @property name - The name of the category.
 * @property type - The type of the category (income, expense, both, or transfer).
 * @property icon - The icon associated with the category.
 * @property color - The color associated with the category.
 * @property parentId - The ID of the parent category, if any.
 */
export interface CategoryCreateRequest {
  name: string;
  type: string;
  icon?: string;
  color?: string;
  parentId?: number;
}

/**
 * Represents a request to update an existing category.
 *
 * @property id - The ID of the category to update.
 * @property name - The new name of the category.
 * @property type - The new type of the category (income, expense, both, or transfer).
 * @property icon - The new icon associated with the category.
 * @property color - The new color associated with the category.
 * @property parentId - The ID of the new parent category, if any.
 */
export interface CategoryUpdateRequest {
  id: number;
  name: string;
  type: string;
  color?: string;
  icon?: string;
  parentId?: number;
}

/**
 * Represents a category view model with additional usage information.
 *
 * @property budgetedAmount - The budgeted amount for the category, if any.
 * @property remainingAmount - The remaining amount for the category, if any.
 * @property percentageUsed - The percentage of the budget used by the category, if any.
 * @extends Category
 */
export interface CategoryBudget extends Category {
  budgetedAmount?: number;
  remainingAmount?: number;
  percentageUsed?: number;
}

/**
 * Represents a parent category and all its child categories.
 *
 * @property parent - The parent category.
 * @property items - The list of child categories of the parent category.
 */
export interface CategoryGroup {
  parent: Category;
  items: Category[];
}

/**
 * One parent to create in a batch, with the subcategories that inherit its type, color and icon.
 *
 * @property name - The parent's name.
 * @property type - The type shared by the parent and its subcategories.
 * @property color - The color shared by the group.
 * @property icon - The icon shared by the group.
 * @property subcategories - The subcategory names, already trimmed and without blanks.
 */
export interface CategoryBatchGroup {
  name: string;
  type: string;
  color?: string;
  icon?: string;
  subcategories: string[];
}

/** Represents a request to create several parents and their subcategories atomically. */
export interface CategoryBatchRequest {
  groups: CategoryBatchGroup[];
}

/**
 * A name the batch skipped.
 *
 * @property parentName - The parent it was meant for, absent for a skipped parent.
 * @property reason - Why it was skipped (for example "Already exists").
 */
export interface CategoryBatchSkipped {
  name: string;
  parentName?: string;
  reason: string;
}

/** What a batch created and what it skipped. */
export interface CategoryBatchResult {
  createdCount: number;
  createdParents: number;
  createdSubcategories: number;
  skipped: CategoryBatchSkipped[];
}
