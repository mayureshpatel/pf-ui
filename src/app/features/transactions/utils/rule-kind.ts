/** Which kind of rule the ledger's rule panel is making (PF-931): a category rule, a merchant rule, or both. */
export type RuleKind = 'category' | 'merchant' | 'both';

/** The words the chooser and the panel use for each kind. */
export const RULE_KIND_LABELS: Record<RuleKind, string> = {
  category: 'Category rule',
  merchant: 'Merchant rule',
  both: 'Both',
};
