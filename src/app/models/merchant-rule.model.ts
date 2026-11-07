import { MatchType, RuleDraft } from '@models/category-rule.model';
import { Merchant } from '@models/merchant.model';

/**
 * Represents a merchant rule: keywords (and an optional amount range) that give a transaction one
 * of the user's merchants.
 *
 * @property id - The unique identifier of the merchant rule.
 * @property userId - The ID of the user who owns the rule.
 * @property keywords - The keyword set the rule matches on.
 * @property matchType - How `keywords` combine: `AND` requires every keyword, `OR` at least one.
 * @property priority - The rule's priority; the highest wins when several rules match.
 * @property merchant - The {@link Merchant} the rule assigns.
 * @property minAmount - Optional lower bound (inclusive) of the amount, ignoring its sign. Null when unset.
 * @property maxAmount - Optional upper bound (inclusive) of the amount, ignoring its sign. Null when unset.
 */
export interface MerchantRule {
  id: number;
  userId: number;
  keywords: string[];
  matchType: MatchType;
  priority: number;
  merchant: Merchant | null;
  minAmount: number | null;
  maxAmount: number | null;
}

/**
 * Represents a request to create a merchant rule. The owner comes from the session, so the request
 * carries no user id.
 *
 * @property merchantId - The merchant the rule assigns.
 * @property keywords - The keyword set the rule matches on. At least one required.
 * @property matchType - How `keywords` combine. Defaults to `OR` on the backend if omitted.
 * @property priority - The rule's priority.
 * @property minAmount - Optional lower bound (inclusive) for the amount-range condition.
 * @property maxAmount - Optional upper bound (inclusive) for the amount-range condition.
 */
export interface MerchantRuleCreateRequest {
  merchantId: number;
  keywords: string[];
  matchType?: MatchType;
  priority?: number;
  minAmount?: number | null;
  maxAmount?: number | null;
}

/** Represents a request to update a merchant rule: the create fields plus the rule's `id`. */
/**
 * A new merchant rule whose merchant does not exist yet (PF-933): the merchant is named here and
 * created together with the rule.
 */
export interface MerchantRuleNewMerchantRequest extends Omit<
  MerchantRuleCreateRequest,
  'merchantId'
> {
  newMerchantName: string;
}

export interface MerchantRuleUpdateRequest extends MerchantRuleCreateRequest {
  id: number;
}

/**
 * What the rule engine would do with a transaction a draft merchant rule matches.
 * `WILL_ASSIGN`: the draft would give its merchant. `LOSES_TO_OTHER_RULE`: another rule wins.
 * `ALREADY_HAS_MERCHANT`: the transaction already has a merchant and is left alone. `LINKED`: its
 * description is linked to a merchant exactly, which also beats any rule.
 */
export type MerchantRuleVerdict =
  'WILL_ASSIGN' | 'LOSES_TO_OTHER_RULE' | 'ALREADY_HAS_MERCHANT' | 'LINKED';

/**
 * A saved rule that also matches a transaction a draft matches.
 *
 * @property id - The rule's id.
 * @property keywords - The rule's keyword set (whether it needs any or all is not reported).
 * @property merchantName - The name of the merchant the rule assigns, or null when unknown.
 * @property priority - The rule's priority.
 */
export interface MerchantRuleRef {
  id: number;
  keywords: string[];
  merchantName: string | null;
  priority: number;
}

/**
 * One transaction matched by a draft merchant rule, with the engine's verdict for it.
 *
 * @property currentMerchant - The transaction's current merchant, or null if it has none.
 * @property otherRules - Other saved rules matching this transaction, in effective order.
 * @property winningRule - The rule that beats the draft; set only for `LOSES_TO_OTHER_RULE`.
 */
export interface MerchantRuleMatchRow {
  transactionId: number;
  date: string;
  description: string;
  amount: number;
  accountName: string | null;
  currentMerchant: Merchant | null;
  verdict: MerchantRuleVerdict;
  otherRules: MerchantRuleRef[];
  winningRule: MerchantRuleRef | null;
}

/**
 * The result of previewing a draft merchant rule against the user's transactions.
 *
 * @property targetMerchantName - The merchant the draft would assign, or null when none is chosen.
 * @property truncated - True when `rows` holds only part of the matches.
 */
export interface MerchantRuleMatchPreview {
  targetMerchantName: string | null;
  totalMatches: number;
  willAssignCount: number;
  losesToOtherRuleCount: number;
  alreadyHasMerchantCount: number;
  linkedCount: number;
  truncated: boolean;
  rows: MerchantRuleMatchRow[];
  /** the ids of every transaction the draft would give a merchant, not only those in `rows` (PF-932) */
  willAssignIds?: number[];
}

/**
 * One transaction the saved merchant rules would give a merchant when applied.
 *
 * @property merchant - The merchant it would get.
 * @property rule - The rule that decided it, or null when unknown.
 */
export interface MerchantRuleChangePreview {
  transactionId: number;
  date: string;
  description: string;
  amount: number;
  accountName: string | null;
  merchant: Merchant | null;
  rule: MerchantRuleRef | null;
}

/**
 * A merchant rule being drafted, sent to the match preview. Like {@link RuleDraft} plus the chosen
 * merchant (null until one is chosen), so the preview can name it.
 */
export interface MerchantRuleDraft extends RuleDraft {
  merchantId: number | null;
}

/**
 * The rule a create-and-apply call creates (PF-932, PF-933): a merchant rule's usual fields, with
 * the merchant either an existing one (`merchantId`) or a new name to create (`newMerchantName`),
 * never both.
 */
export interface MerchantRuleApplyRule {
  merchantId?: number | null;
  newMerchantName?: string | null;
  keywords: string[];
  matchType?: MatchType;
  priority?: number;
  minAmount?: number | null;
  maxAmount?: number | null;
}

/** A request to create a merchant rule and apply it to the transactions the user chose (PF-932). */
export interface MerchantRuleApplyRequest {
  rule: MerchantRuleApplyRule;
  transactionIds: number[];
}

/** One transaction a merchant create-and-apply changed, with the merchant it had before. */
export interface AppliedMerchantChange {
  transactionId: number;
  previousMerchantId: number | null;
}

/**
 * The result of a merchant create-and-apply, kept so the change can be undone (PF-928).
 *
 * @property ruleId - The id of the rule that was created.
 * @property merchantId - The merchant the rule set (an existing one, or the one just created).
 * @property changes - Every transaction that was changed, with its previous merchant.
 */
export interface MerchantRuleApplyResult {
  ruleId: number;
  merchantId: number;
  changes: AppliedMerchantChange[];
}
