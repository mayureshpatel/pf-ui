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
 * @property minAmount - Optional lower bound (inclusive) a transaction's amount must meet, in
 * addition to the keyword match, for this rule to apply. Null when no range is set.
 * @property maxAmount - Optional upper bound (inclusive) a transaction's amount must meet, in
 * addition to the keyword match, for this rule to apply. Null when no range is set.
 */
export interface CategoryRule {
  id: number;
  userId: number;
  keyword: string;
  priority: number;
  category: Category;
  minAmount: number | null;
  maxAmount: number | null;
}

/**
 * Represents a request to create a category rule.
 *
 * @property userId - The ID of the user creating the category rule.
 * @property categoryId - The ID of the category associated with the category rule.
 * @property keyword - The keyword associated with the category rule.
 * @property priority - The priority of the category rule.
 * @property minAmount - Optional lower bound (inclusive) for the amount-range condition.
 * @property maxAmount - Optional upper bound (inclusive) for the amount-range condition.
 */
export interface CategoryRuleCreateRequest {
  userId: number;
  categoryId: number;
  keyword: string;
  priority: number;
  minAmount?: number | null;
  maxAmount?: number | null;
}

/**
 * Represents a request to update a category rule.
 *
 * @property id - The ID of the category rule to update.
 * @property categoryId - The ID of the category associated with the category rule.
 * @property keyword - The keyword associated with the category rule.
 * @property priority - The priority of the category rule.
 * @property minAmount - Optional lower bound (inclusive) for the amount-range condition.
 * @property maxAmount - Optional upper bound (inclusive) for the amount-range condition.
 */
export interface CategoryRuleUpdateRequest {
  id: number;
  categoryId: number;
  keyword: string;
  priority: number;
  minAmount?: number | null;
  maxAmount?: number | null;
}

/**
 * Represents a preview of changes made to a category rule.
 *
 * @property description - The original transaction description.
 * @property oldValue - The value before rule application. Always the literal string
 * "Uncategorized" — `CategoryRuleService.previewApply()` only ever considers already-uncategorized
 * transactions, so this is never actually null despite the field's name suggesting it might be.
 * @property newValue - The projected value after rule application.
 */
export interface RuleChangePreview {
  description: string;
  oldValue: string;
  newValue: string;
}
