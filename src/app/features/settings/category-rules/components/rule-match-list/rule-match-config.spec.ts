import { Mock, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, Subject } from 'rxjs';
import { RuleDraft } from '@models/category-rule.model';
import {
  MerchantRuleDraft,
  MerchantRuleMatchPreview,
  MerchantRuleMatchRow,
  MerchantRuleRef,
} from '@models/merchant-rule.model';
import { Merchant } from '@models/merchant.model';
import { MerchantRuleApiService } from '../../../merchant-rules/merchant-rule-api.service';
import { CategoryRuleApiService } from '../../services/category-rule-api.service';
import { merchantMatchConfig, RULE_MATCH_CONFIG } from './rule-match-config';
import { RuleMatchListComponent } from './rule-match-list.component';

const draft = (keywords: string[], over: Partial<MerchantRuleDraft> = {}): MerchantRuleDraft => ({
  ruleId: null,
  keywords,
  matchType: 'OR',
  priority: 1,
  minAmount: null,
  maxAmount: null,
  merchantId: 6,
  ...over,
});
const ref = (
  id: number,
  keywords: string[],
  merchantName: string | null,
  priority: number,
): MerchantRuleRef => ({ id, keywords, merchantName, priority });
const row = (
  transactionId: number,
  over: Partial<MerchantRuleMatchRow> = {},
): MerchantRuleMatchRow => ({
  transactionId,
  date: '2026-10-05T00:00:00Z',
  description: `KROGER #${transactionId}`,
  amount: -42.5,
  accountName: 'Checking',
  currentMerchant: null,
  verdict: 'WILL_ASSIGN',
  otherRules: [],
  winningRule: null,
  ...over,
});
const preview = (
  rows: MerchantRuleMatchRow[],
  over: Partial<MerchantRuleMatchPreview> = {},
): MerchantRuleMatchPreview => ({
  targetMerchantName: 'Kroger',
  totalMatches: rows.length,
  willAssignCount: rows.filter((r) => r.verdict === 'WILL_ASSIGN').length,
  losesToOtherRuleCount: rows.filter((r) => r.verdict === 'LOSES_TO_OTHER_RULE').length,
  alreadyHasMerchantCount: rows.filter((r) => r.verdict === 'ALREADY_HAS_MERCHANT').length,
  linkedCount: rows.filter((r) => r.verdict === 'LINKED').length,
  truncated: false,
  rows,
  ...over,
});

describe('RuleMatchListComponent for merchant rules', () => {
  let fixture: ComponentFixture<RuleMatchListComponent>;
  let previewMatches: Mock<(d: MerchantRuleDraft) => Observable<MerchantRuleMatchPreview>>;
  let calls: Subject<MerchantRuleMatchPreview>[];

  const el = (): HTMLElement => fixture.nativeElement;
  const text = (): string => (el().textContent ?? '').replace(/\s+/g, ' ');
  const rows = (): HTMLLIElement[] => Array.from(el().querySelectorAll('[data-match-row]'));
  const rowText = (i: number): string => (rows()[i].textContent ?? '').replace(/\s+/g, ' ');
  const summary = (): string =>
    (el().querySelector('[data-testid="match-summary"]')!.textContent ?? '').replace(/\s+/g, ' ');

  function search(value: MerchantRuleDraft | null, result: MerchantRuleMatchPreview): void {
    fixture.componentRef.setInput('draft', value);
    fixture.detectChanges();
    vi.advanceTimersByTime(300);
    calls[calls.length - 1].next(result);
    calls[calls.length - 1].complete();
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    calls = [];
    previewMatches = vi.fn((): Observable<MerchantRuleMatchPreview> => {
      const subject = new Subject<MerchantRuleMatchPreview>();
      calls.push(subject);
      return subject;
    });
    TestBed.configureTestingModule({
      imports: [RuleMatchListComponent],
      providers: [
        { provide: MerchantRuleApiService, useValue: { previewMatches } },
        // the category service must not be touched in merchant mode
        { provide: CategoryRuleApiService, useValue: {} },
        {
          provide: RULE_MATCH_CONFIG,
          useFactory: () => merchantMatchConfig(TestBed.inject(MerchantRuleApiService)),
        },
      ],
    });
    fixture = TestBed.createComponent(RuleMatchListComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should preview through the merchant endpoint, 300 ms after the draft stops changing, with the merchant id', () => {
    // act
    fixture.componentRef.setInput('draft', draft(['kroger'], { merchantId: 6 }));
    fixture.detectChanges();
    vi.advanceTimersByTime(299);
    const early = previewMatches.mock.calls.length;
    vi.advanceTimersByTime(1);

    // assert & verify
    expect(early).toBe(0);
    expect(previewMatches).toHaveBeenCalledTimes(1);
    expect(previewMatches.mock.calls[0][0]).toEqual(
      expect.objectContaining({ keywords: ['kroger'], merchantId: 6 }),
    );
  });

  it('should send a null merchant id when the draft has none', () => {
    // act
    fixture.componentRef.setInput('draft', {
      ruleId: null,
      keywords: ['kroger'],
      matchType: 'OR',
      priority: 0,
      minAmount: null,
      maxAmount: null,
    } as RuleDraft);
    fixture.detectChanges();
    vi.advanceTimersByTime(300);

    // assert & verify
    expect(previewMatches.mock.calls[0][0].merchantId).toBeNull();
  });

  it('should word the summary and every verdict for merchants', () => {
    // arrange
    const winner = ref(4, ['kroger', '431'], 'Kroger Fuel', 5);
    const result = preview([
      row(1),
      row(2, { verdict: 'LOSES_TO_OTHER_RULE', winningRule: winner, otherRules: [winner] }),
      row(3, {
        verdict: 'ALREADY_HAS_MERCHANT',
        currentMerchant: { id: 2, name: 'Costco' } as Merchant,
      }),
      row(4, { verdict: 'LINKED' }),
    ]);

    // act
    search(draft(['kroger']), result);

    // assert & verify
    expect(summary()).toContain('4 matches');
    expect(summary()).toContain('1 will be assigned to Kroger');
    expect(summary()).toContain('1 of them: no other rule affects it');
    expect(summary()).toContain('1 would lose to another rule');
    expect(summary()).toContain('1 already have a merchant, the rule leaves them alone');
    expect(summary()).toContain(
      '1 linked to a merchant by an exact description link, the rule leaves them alone',
    );
    const verdicts = Array.from(el().querySelectorAll('[data-testid="verdict"]')).map((v) =>
      (v.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
    expect(verdicts).toEqual([
      'Will be assigned to Kroger',
      'Loses to a rule with keywords "kroger", "431" (priority 5)',
      'Already has a merchant, the rule leaves it alone',
      'Linked to a merchant by an exact description link, the rule leaves it alone',
    ]);
    expect(rowText(0)).toContain('No merchant');
    expect(rowText(2)).toContain('Costco');
    expect(rowText(0)).not.toContain('Uncategorized');
  });

  it('should list the other matching rules without the winner, naming their merchant', () => {
    // arrange
    const winner = ref(4, ['kroger'], 'Kroger Fuel', 5);
    const other = ref(5, ['fuel', 'perks'], null, 2);
    const result = preview([
      row(1, {
        verdict: 'LOSES_TO_OTHER_RULE',
        winningRule: winner,
        otherRules: [winner, other],
      }),
    ]);

    // act
    search(draft(['kroger']), result);

    // assert & verify
    expect(rowText(0)).toContain('Loses to a rule with keyword "kroger" (priority 5)');
    expect(rowText(0)).toContain('Also matches: a rule with keywords "fuel", "perks"');
    expect(rowText(0)).toContain('(no merchant) (priority 2)');
    expect(rowText(0)).not.toContain('Kroger Fuel (priority 5)');
  });

  it('should cap the rows, say how many more there are and keep a bounded labelled region', () => {
    // arrange
    const result = preview([row(1), row(2)], { totalMatches: 120, truncated: true });

    // act
    search(draft(['kroger']), result);

    // assert & verify
    expect(text()).toContain('and 118 more');
    expect(summary()).not.toContain('no other rule affects it');
    const region = el().querySelector('[data-testid="match-rows"]')!;
    expect(region.getAttribute('role')).toBe('region');
    expect(region.getAttribute('aria-label')).toBe('Matching transactions');
    expect(region.className).toContain('max-h-96');
  });

  it('should show the loading, error and retry states like the category list', () => {
    // arrange
    fixture.componentRef.setInput('draft', draft(['kroger']));
    fixture.detectChanges();
    vi.advanceTimersByTime(300);

    // act
    calls[0].error(new Error('boom'));
    fixture.detectChanges();
    const failed = text();
    const retry = Array.from(el().querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Retry',
    )!;
    retry.click();
    fixture.detectChanges();
    calls[1].next(preview([row(1)]));
    calls[1].complete();
    fixture.detectChanges();

    // assert & verify
    expect(failed).toContain("Couldn't load matching transactions");
    expect(rows()).toHaveLength(1);
    expect(text()).not.toContain("Couldn't load matching transactions");
  });

  it('should ask for a fix, and send nothing, while the keywords are refused', () => {
    // act
    fixture.componentRef.setInput('draft', null);
    fixture.componentRef.setInput('invalid', true);
    fixture.detectChanges();
    vi.advanceTimersByTime(1000);

    // assert & verify
    expect(text()).toContain('Fix the keywords to see matches');
    expect(previewMatches).not.toHaveBeenCalled();
  });

  it('should say when nothing matches', () => {
    // act
    search(draft(['zzz']), preview([]));

    // assert & verify
    expect(summary()).toContain('No transactions match');
  });
});

describe('RULE_MATCH_CONFIG', () => {
  it('should default to the category rules preview', () => {
    // arrange
    const previewMatches = vi.fn().mockReturnValue(
      of({
        totalMatches: 0,
        willCategorizeCount: 0,
        losesToOtherRuleCount: 0,
        alreadyCategorizedCount: 0,
        truncated: false,
        rows: [],
      }),
    );
    TestBed.configureTestingModule({
      providers: [{ provide: CategoryRuleApiService, useValue: { previewMatches } }],
    });

    // act
    const config = TestBed.inject(RULE_MATCH_CONFIG);
    config.preview({} as RuleDraft).subscribe();

    // assert & verify
    expect(previewMatches).toHaveBeenCalled();
    expect(config.labels.willRow(null)).toBe('Will be categorized');
    expect(config.labels.currentNone).toBe('Uncategorized');
  });
});
