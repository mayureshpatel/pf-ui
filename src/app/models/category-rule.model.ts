import { Category } from '@models/category.model';

/**
 * How a rule's {@link CategoryRule.keywords} combine when matching a transaction description.
 * `AND` requires every keyword present; `OR` requires at least one.
 */
export type MatchType = 'AND' | 'OR';

/**
 * Represents a category rule object.
 *
 * Maps directly to the CategoryRule entity in the database, without audit fields.
 *
 * @property id - The unique identifier of the category rule.
 * @property userId - The ID of the user associated with the category rule.
 * @property keywords - The keyword set the rule matches on. A single-keyword rule is the
 * degenerate case: one element, matchType `OR`.
 * @property matchType - How `keywords` combine: `AND` requires every keyword present, `OR`
 * requires at least one.
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
  keywords: string[];
  matchType: MatchType;
  priority: number;
  category: Category | null;
  minAmount: number | null;
  maxAmount: number | null;
}

/**
 * Represents a request to create a category rule.
 *
 * @property userId - The ID of the user creating the category rule.
 * @property categoryId - The ID of the category associated with the category rule.
 * @property keywords - The keyword set the rule matches on. At least one required.
 * @property matchType - How `keywords` combine. Defaults to `OR` on the backend if omitted.
 * @property priority - The priority of the category rule.
 * @property minAmount - Optional lower bound (inclusive) for the amount-range condition.
 * @property maxAmount - Optional upper bound (inclusive) for the amount-range condition.
 */
export interface CategoryRuleCreateRequest {
  userId: number;
  categoryId: number;
  keywords: string[];
  matchType?: MatchType;
  priority: number;
  minAmount?: number | null;
  maxAmount?: number | null;
}

/**
 * Represents a request to update a category rule.
 *
 * @property id - The ID of the category rule to update.
 * @property categoryId - The ID of the category associated with the category rule.
 * @property keywords - The keyword set the rule matches on. At least one required.
 * @property matchType - How `keywords` combine. Defaults to `OR` on the backend if omitted.
 * @property priority - The priority of the category rule.
 * @property minAmount - Optional lower bound (inclusive) for the amount-range condition.
 * @property maxAmount - Optional upper bound (inclusive) for the amount-range condition.
 */
export interface CategoryRuleUpdateRequest {
  id: number;
  categoryId: number;
  keywords: string[];
  matchType?: MatchType;
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
 * @property decidedBy - Optional wording for the rule that decides the change; when any item has
 * one, the apply dialog shows a "Decided by" column. Category rules leave it out.
 */
export interface RuleChangePreview {
  description: string;
  oldValue: string;
  newValue: string;
  decidedBy?: string;
}

/**
 * What the rule engine would do with a transaction a draft rule matches.
 * `WILL_CATEGORIZE`: the draft would assign its category. `LOSES_TO_OTHER_RULE`: a higher-ranked
 * rule also matches and wins. `ALREADY_CATEGORIZED`: the transaction already has a category and is
 * left alone.
 */
export type RuleVerdict = 'WILL_CATEGORIZE' | 'LOSES_TO_OTHER_RULE' | 'ALREADY_CATEGORIZED';

/**
 * A rule that competes with a draft for the same transaction.
 *
 * @property id - The rule's id.
 * @property keywords - The rule's keyword set.
 * @property categoryName - The name of the category the rule assigns, or null when the rule has no
 * category.
 * @property priority - The rule's priority.
 */
export interface RuleRef {
  id: number;
  keywords: string[];
  categoryName: string | null;
  priority: number;
}

/**
 * One transaction matched by a draft rule, with the engine's verdict for it.
 *
 * @property transactionId - The matched transaction's id.
 * @property date - The transaction date (ISO string).
 * @property description - The transaction description.
 * @property amount - The transaction amount.
 * @property accountName - The name of the account the transaction belongs to, or null when it has
 * none.
 * @property currentCategory - The transaction's current category, or null if uncategorized.
 * @property verdict - What the engine would do with the transaction.
 * @property otherRules - Other rules matching this transaction (relevant to `LOSES_TO_OTHER_RULE`).
 */
export interface RuleMatchRow {
  transactionId: number;
  date: string;
  description: string;
  amount: number;
  accountName: string | null;
  currentCategory: Category | null;
  verdict: RuleVerdict;
  otherRules: RuleRef[];
}

/**
 * The result of previewing a draft rule against the user's transactions.
 *
 * @property totalMatches - How many transactions the draft matches.
 * @property willCategorizeCount - Matches the draft would categorize.
 * @property losesToOtherRuleCount - Matches that a higher-ranked rule would win.
 * @property alreadyCategorizedCount - Matches that already have a category.
 * @property truncated - True when `rows` holds only part of the matches.
 * @property rows - The matched transactions (possibly capped).
 */
export interface RuleMatchPreview {
  totalMatches: number;
  willCategorizeCount: number;
  losesToOtherRuleCount: number;
  alreadyCategorizedCount: number;
  truncated: boolean;
  rows: RuleMatchRow[];
}

/**
 * A rule being drafted, sent to the match preview. The category is irrelevant to matching and so
 * is omitted.
 *
 * @property ruleId - The id of the rule being edited, or null for a new rule.
 * @property keywords - The draft's keyword set.
 * @property matchType - How `keywords` combine.
 * @property priority - The draft's priority.
 * @property minAmount - Optional lower bound (inclusive), or null.
 * @property maxAmount - Optional upper bound (inclusive), or null.
 */
export interface RuleDraft {
  ruleId: number | null;
  keywords: string[];
  matchType: MatchType;
  priority: number;
  minAmount: number | null;
  maxAmount: number | null;
}
