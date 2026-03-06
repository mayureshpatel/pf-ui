import {Category} from '@models/category.model';

/**
 * Represents a category rule object.
 *
 * Maps directly to the CategoryRule entity in the database, without audit fields.
 *
 * @property id - The unique identifier of the category rule.
 * @property userId - The ID of the user associated with the category rule.
 * @property keyword - The keyword associated with the category rule.
 * @property priority - The priority of the category rule.
 * @property category - The {@link Category} associated with the category rule.
 */
export interface CategoryRule {
  id: number;
  userId: number;
  keyword: string;
  priority: number;
  category: Category;
}

/**
 * Represents a request to create a category rule.
 *
 * @property userId - The ID of the user creating the category rule.
 * @property categoryId - The ID of the category associated with the category rule.
 * @property keyword - The keyword associated with the category rule.
 * @property priority - The priority of the category rule.
 */
export interface CategoryRuleCreateRequest {
  userId: number;
  categoryId: number;
  keyword: string;
  priority: number;
}

/**
 * Represents a request to update a category rule.
 *
 * @property id - The ID of the category rule to update.
 * @property categoryId - The ID of the category associated with the category rule.
 * @property keyword - The keyword associated with the category rule.
 * @property priority - The priority of the category rule.
 */
export interface CategoryRuleUpdateRequest {
  id: number;
  categoryId: number;
  keyword: string;
  priority: number;
}

/**
 * Represents a preview of changes made to a category rule.
 *
 * @property description - A description of the change.
 * @property oldValue - The old value of the rule.
 * @property newValue - The new value of the rule.
 */
export interface RuleChangePreview {
  description: string;
  oldValue: string;
  newValue: string;
}
