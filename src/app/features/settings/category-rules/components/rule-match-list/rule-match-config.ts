import { inject, InjectionToken } from '@angular/core';
import { map, Observable } from 'rxjs';
import { RuleDraft, RuleMatchPreview } from '@models/category-rule.model';
import { MerchantRuleDraft, MerchantRuleMatchPreview } from '@models/merchant-rule.model';
import { CategoryRuleApiService } from '../../services/category-rule-api.service';
import { MerchantRuleApiService } from '../../../merchant-rules/merchant-rule-api.service';

/** What the engine would do with a matched transaction, whichever kind of rule it is. */
export type MatchVerdict = 'WILL_APPLY' | 'LOSES_TO_OTHER_RULE' | 'ALREADY_SET' | 'LINKED';

/** A rule that competes with the draft, with the name of what it sets (a category or a merchant). */
export interface MatchRuleRef {
  id: number;
  keywords: string[];
  targetName: string | null;
  priority: number;
}

/** One matched transaction, as the list shows it. */
export interface MatchRowData {
  transactionId: number;
  date: string;
  description: string;
  amount: number;
  accountName: string | null;
  /** the name of the category or merchant the transaction has now, or null when it has none */
  currentName: string | null;
  verdict: MatchVerdict;
  /** the rule that beats the draft on a `LOSES_TO_OTHER_RULE` row */
  winner: MatchRuleRef | null;
  /** the other matching rules, apart from the winner */
  alsoMatches: MatchRuleRef[];
}

/** A preview of a draft rule, in the terms the list shows. */
export interface MatchPreviewData {
  totalMatches: number;
  willApplyCount: number;
  losesToOtherRuleCount: number;
  alreadySetCount: number;
  linkedCount: number;
  truncated: boolean;
  /** what the draft would assign (a merchant's name), when the preview says; null otherwise */
  targetName: string | null;
  rows: MatchRowData[];
  /**
   * the ids of every match the draft would handle (`WILL_APPLY`), including those beyond the capped
   * `rows`, so the ledger can apply a rule to all of them (PF-926)
   */
  willApplyIds: number[];
}

/** The wording the list uses for one kind of rule. */
export interface MatchListLabels {
  /** the screen-reader label before a row's current value, e.g. `Current category: ` */
  currentLabel: string;
  /** shown for a row that has no current value */
  currentNone: string;
  /** shown for a competing rule that sets nothing */
  targetNone: string;
  /** the summary line for rows the draft would handle, after its count */
  willSummary: (targetName: string | null) => string;
  /** the verdict of a row the draft would handle */
  willRow: (targetName: string | null) => string;
  /** the summary line and verdict for rows that already have a value */
  alreadySummary: string;
  alreadyRow: string;
  /** the summary line and verdict for rows linked by an exact description link */
  linkedSummary: string;
  linkedRow: string;
  /** the group headings of the ledger's selectable list (PF-926) */
  groupSet: string;
  groupChange: string;
  groupKeep: string;
}

/** What the match list needs to know about a kind of rule: how to preview a draft, and what to call things. */
export interface RuleMatchConfig {
  preview: (draft: RuleDraft) => Observable<MatchPreviewData>;
  labels: MatchListLabels;
}

/** The config for category rules. */
export function categoryMatchConfig(api: CategoryRuleApiService): RuleMatchConfig {
  return {
    preview: (draft: RuleDraft): Observable<MatchPreviewData> =>
      api.previewMatches(draft).pipe(map(fromCategoryPreview)),
    labels: {
      currentLabel: 'Current category: ',
      currentNone: 'Uncategorized',
      targetNone: '(no category)',
      willSummary: (): string => 'will be categorized by this rule',
      willRow: (): string => 'Will be categorized',
      alreadySummary: 'already categorized - Apply rules leaves them alone',
      alreadyRow: 'Already categorized - Apply rules leaves it alone',
      linkedSummary: '',
      linkedRow: '',
      groupSet: 'Will be set (no category today)',
      groupChange: 'Will change',
      groupKeep: "Won't change",
    },
  };
}

/** The config for merchant rules. */
export function merchantMatchConfig(api: MerchantRuleApiService): RuleMatchConfig {
  return {
    preview: (draft: RuleDraft): Observable<MatchPreviewData> =>
      api.previewMatches(withMerchant(draft)).pipe(map(fromMerchantPreview)),
    labels: {
      currentLabel: 'Current merchant: ',
      currentNone: 'No merchant',
      targetNone: '(no merchant)',
      willSummary: (name: string | null): string => `will be assigned to ${name ?? 'the merchant'}`,
      willRow: (name: string | null): string => `Will be assigned to ${name ?? 'the merchant'}`,
      alreadySummary: 'already have a merchant, the rule leaves them alone',
      alreadyRow: 'Already has a merchant, the rule leaves it alone',
      linkedSummary:
        'linked to a merchant by an exact description link, the rule leaves them alone',
      linkedRow: 'Linked to a merchant by an exact description link, the rule leaves it alone',
      groupSet: 'Will be set (no merchant today)',
      groupChange: 'Will change',
      groupKeep: "Won't change",
    },
  };
}

/** The category rules' config unless a host provides another (the merchant rules page does). */
export const RULE_MATCH_CONFIG = new InjectionToken<RuleMatchConfig>('RULE_MATCH_CONFIG', {
  providedIn: 'root',
  factory: (): RuleMatchConfig => categoryMatchConfig(inject(CategoryRuleApiService)),
});

function withMerchant(draft: RuleDraft): MerchantRuleDraft {
  const merchantId: number | null = (draft as Partial<MerchantRuleDraft>).merchantId ?? null;
  return { ...draft, merchantId };
}

function fromCategoryPreview(p: RuleMatchPreview): MatchPreviewData {
  return {
    totalMatches: p.totalMatches,
    willApplyCount: p.willCategorizeCount,
    losesToOtherRuleCount: p.losesToOtherRuleCount,
    alreadySetCount: p.alreadyCategorizedCount,
    linkedCount: 0,
    truncated: p.truncated,
    targetName: null,
    willApplyIds:
      p.willCategorizeIds ??
      p.rows.filter((row) => row.verdict === 'WILL_CATEGORIZE').map((row) => row.transactionId),
    rows: p.rows.map((row) => {
      const refs: MatchRuleRef[] = row.otherRules.map((r) => ({
        id: r.id,
        keywords: r.keywords,
        targetName: r.categoryName,
        priority: r.priority,
      }));
      const loses: boolean = row.verdict === 'LOSES_TO_OTHER_RULE';
      return {
        transactionId: row.transactionId,
        date: row.date,
        description: row.description,
        amount: row.amount,
        accountName: row.accountName,
        currentName: row.currentCategory?.name || null,
        verdict:
          row.verdict === 'WILL_CATEGORIZE'
            ? 'WILL_APPLY'
            : row.verdict === 'ALREADY_CATEGORIZED'
              ? 'ALREADY_SET'
              : 'LOSES_TO_OTHER_RULE',
        winner: loses ? (refs[0] ?? null) : null,
        alsoMatches: loses ? refs.slice(1) : refs,
      };
    }),
  };
}

function fromMerchantPreview(p: MerchantRuleMatchPreview): MatchPreviewData {
  return {
    totalMatches: p.totalMatches,
    willApplyCount: p.willAssignCount,
    losesToOtherRuleCount: p.losesToOtherRuleCount,
    alreadySetCount: p.alreadyHasMerchantCount,
    linkedCount: p.linkedCount,
    truncated: p.truncated,
    targetName: p.targetMerchantName ?? null,
    willApplyIds:
      p.willAssignIds ??
      p.rows.filter((row) => row.verdict === 'WILL_ASSIGN').map((row) => row.transactionId),
    rows: p.rows.map((row) => {
      const toRef = (r: {
        id: number;
        keywords: string[];
        merchantName: string | null;
        priority: number;
      }): MatchRuleRef => ({
        id: r.id,
        keywords: r.keywords ?? [],
        targetName: r.merchantName ?? null,
        priority: r.priority,
      });
      const refs: MatchRuleRef[] = (row.otherRules ?? []).map(toRef);
      const loses: boolean = row.verdict === 'LOSES_TO_OTHER_RULE';
      const winner: MatchRuleRef | null = loses
        ? row.winningRule
          ? toRef(row.winningRule)
          : (refs[0] ?? null)
        : null;
      return {
        transactionId: row.transactionId,
        date: row.date,
        description: row.description,
        amount: row.amount,
        accountName: row.accountName ?? null,
        currentName: row.currentMerchant?.name || null,
        verdict:
          row.verdict === 'WILL_ASSIGN'
            ? 'WILL_APPLY'
            : row.verdict === 'ALREADY_HAS_MERCHANT'
              ? 'ALREADY_SET'
              : row.verdict === 'LINKED'
                ? 'LINKED'
                : 'LOSES_TO_OTHER_RULE',
        winner,
        alsoMatches: winner ? refs.filter((r) => r.id !== winner.id) : refs,
      };
    }),
  };
}
