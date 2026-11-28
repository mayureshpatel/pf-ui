import { vi, Mocked } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { Merchant } from '@models/merchant.model';
import {
  MerchantRuleCoverage,
  MerchantRuleMatchPreview,
  MerchantRuleOverlap,
} from '@models/merchant-rule.model';
import { ToastService } from '@core/services/toast.service';
import { MerchantRuleApiService } from '@features/settings/merchant-rules/merchant-rule-api.service';
import { overlapSentence, RuleOfferComponent } from './rule-offer.component';

const KROGER: Merchant = {
  id: 10,
  userId: 1,
  name: 'Kroger',
  city: null,
  state: null,
  postalCode: null,
  country: null,
};
const STORE = 'KROGER #431';
const STORE_2 = 'KROGER #12';
const NOT_COVERED: MerchantRuleCoverage = { merchantId: 10, coveredDescriptions: [], rules: [] };

const fuelWins: MerchantRuleOverlap = {
  outcome: 'OTHER_WINS',
  reason: 'LONGER_KEYWORDS',
  merchantId: 11,
  merchantName: 'Kroger Fuel Center',
  rule: { id: 3, keywords: ['kroger fuel'], merchantName: 'Kroger Fuel Center', priority: 0 },
  descriptionCount: 6,
  transactionCount: 14,
  descriptions: ['KROGER FUEL #1'],
};

const previewOf = (over: Partial<MerchantRuleMatchPreview> = {}): MerchantRuleMatchPreview => ({
  targetMerchantName: 'Kroger',
  totalMatches: 12,
  willAssignCount: 3,
  losesToOtherRuleCount: 0,
  alreadyHasMerchantCount: 9,
  linkedCount: 0,
  truncated: false,
  rows: [],
  willAssignIds: [101, 102, 103],
  overlaps: [],
  ...over,
});

describe('RuleOfferComponent', () => {
  let fixture: ComponentFixture<RuleOfferComponent>;
  let component: RuleOfferComponent;
  let ruleApi: Mocked<
    Pick<MerchantRuleApiService, 'coverage' | 'previewMatches' | 'createRule' | 'createAndApply'>
  >;
  let toast: Mocked<Pick<ToastService, 'success' | 'error'>>;
  let created: number;
  let skipped: number;

  const el = (testId: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid=${testId}]`);
  const all = (testId: string): string[] =>
    Array.from(
      fixture.nativeElement.querySelectorAll(`[data-testid=${testId}]`) as NodeListOf<HTMLElement>,
    ).map((e) => e.textContent!.replace(/\s+/g, ' ').trim());
  const title = (): string =>
    (fixture.nativeElement.querySelector('#rule-offer-title')?.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim();
  const settle = (): void => {
    vi.advanceTimersByTime(300);
    fixture.detectChanges();
  };
  const press = (target: HTMLElement, key: string): void => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    fixture.detectChanges();
  };
  const create = (descriptions: string[] = [STORE, STORE_2]): void => {
    fixture = TestBed.createComponent(RuleOfferComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('merchant', KROGER);
    fixture.componentRef.setInput('descriptions', descriptions);
    fixture.componentRef.setInput('initialKeyword', 'kroger');
    created = 0;
    skipped = 0;
    component.created.subscribe(() => created++);
    component.skip.subscribe(() => skipped++);
    fixture.detectChanges();
  };

  beforeEach(() => {
    vi.useFakeTimers();
    ruleApi = {
      coverage: vi.fn().mockReturnValue(of(NOT_COVERED)),
      previewMatches: vi.fn().mockReturnValue(of(previewOf())),
      createRule: vi.fn().mockReturnValue(of(9)),
      createAndApply: vi.fn().mockReturnValue(of({ ruleId: 9, merchantId: 10, changes: [] })),
    };
    toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      imports: [RuleOfferComponent],
      providers: [
        { provide: MerchantRuleApiService, useValue: ruleApi },
        { provide: ToastService, useValue: toast },
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  it('should offer the group key as the keyword and preview what the rule matches', () => {
    // act
    create();
    settle();

    // assert & verify
    expect(ruleApi.coverage).toHaveBeenCalledWith(10, [STORE, STORE_2]);
    expect(title()).toBe('Also create rule: `kroger` → Kroger');
    expect(ruleApi.previewMatches).toHaveBeenCalledWith(
      expect.objectContaining({ keywords: ['kroger'], merchantId: 10, ruleId: null }),
    );
    expect(el('rule-offer-matches')?.textContent?.trim()).toBe(
      'Matches 12 transactions; would fill 3 blank ones.',
    );
    expect(ruleApi.createRule).not.toHaveBeenCalled();
    expect(ruleApi.createAndApply).not.toHaveBeenCalled();
  });

  it('should name the merchant that wins shared descriptions, and why', () => {
    // arrange
    ruleApi.previewMatches.mockReturnValue(of(previewOf({ overlaps: [fuelWins] })));

    // act
    create();
    settle();

    // assert & verify
    expect(all('rule-offer-overlap')).toEqual([
      'Kroger Fuel Center wins on 6 descriptions: longer keywords',
    ]);
  });

  it('should word each overlap outcome and reason', () => {
    // assert & verify
    expect(overlapSentence({ ...fuelWins, reason: 'LINK', descriptionCount: 1 })).toBe(
      'Kroger Fuel Center wins on 1 description: linked descriptions',
    );
    expect(
      overlapSentence({ ...fuelWins, outcome: 'THIS_RULE_WINS', reason: 'HIGHER_PRIORITY' }),
    ).toBe('This rule takes 6 descriptions from Kroger Fuel Center: higher priority');
  });

  it('should say a rule already covers the group, and offer none', () => {
    // arrange
    ruleApi.coverage.mockReturnValue(
      of({
        merchantId: 10,
        coveredDescriptions: [STORE, STORE_2],
        rules: [{ id: 4, keywords: ['kroger'], merchantName: 'Kroger', priority: 0 }],
      }),
    );

    // act
    create();
    settle();

    // assert & verify
    expect(el('rule-offer-covered')?.textContent?.trim()).toBe('A rule already covers this');
    expect(fixture.nativeElement.textContent).toContain('`kroger` → Kroger');
    expect(el('rule-offer-create')).toBeNull();
    el('rule-offer-ok')!.click();
    expect(skipped).toBe(1);
  });

  it('should still offer the rule when only some descriptions are covered', () => {
    // arrange
    ruleApi.coverage.mockReturnValue(
      of({ merchantId: 10, coveredDescriptions: [STORE], rules: [] }),
    );

    // act
    create();
    settle();

    // assert & verify
    expect(el('rule-offer-covered')).toBeNull();
    expect(el('rule-offer-create')).not.toBeNull();
  });

  it('should still offer the rule when the coverage check fails', () => {
    // arrange
    ruleApi.coverage.mockReturnValue(throwError(() => new Error('down')));

    // act
    create();
    settle();

    // assert & verify
    expect(el('rule-offer-create')).not.toBeNull();
  });

  it('should create nothing on Enter while the coverage check is still running', () => {
    // arrange
    const reply = new Subject<MerchantRuleCoverage>();
    ruleApi.coverage.mockReturnValue(reply);
    create();
    settle();

    // act
    press(el('rule-offer')!, 'Enter');
    component.submit();

    // assert & verify
    expect(fixture.nativeElement.textContent).toContain('Checking the rules for Kroger…');
    expect(ruleApi.createRule).not.toHaveBeenCalled();
    expect(skipped).toBe(0);
  });

  it('should dismiss on Enter when a rule already covers the group', () => {
    // arrange
    ruleApi.coverage.mockReturnValue(
      of({ merchantId: 10, coveredDescriptions: [STORE, STORE_2], rules: [] }),
    );
    create();

    // act
    press(el('rule-offer')!, 'Enter');

    // assert & verify
    expect(skipped).toBe(1);
    expect(ruleApi.createRule).not.toHaveBeenCalled();
  });

  it('should wait for the new preview before creating while "Also fill" is ticked', () => {
    // arrange
    create();
    settle();
    (el('rule-offer-fill') as HTMLInputElement).click();
    fixture.detectChanges();

    // act: an edit sends a new draft, whose preview is not back yet
    component.form.controls.priority.setValue(3);
    fixture.detectChanges();
    const waiting: boolean = (el('rule-offer-create') as HTMLButtonElement).disabled;
    component.submit();
    const sentWhileWaiting: number = ruleApi.createRule.mock.calls.length;
    settle();
    el('rule-offer-create')!.click();
    fixture.detectChanges();

    // assert & verify
    expect(waiting).toBe(true);
    expect(sentWhileWaiting).toBe(0);
    expect(ruleApi.createRule).not.toHaveBeenCalled();
    expect(ruleApi.createAndApply).toHaveBeenCalledWith({
      rule: expect.objectContaining({ priority: 3 }),
      transactionIds: [101, 102, 103],
    });
  });

  it('should still say the rule was created when the card closed while it was saving', () => {
    // arrange
    const reply = new Subject<number>();
    ruleApi.createRule.mockReturnValue(reply);
    create();
    settle();
    el('rule-offer-create')!.click();

    // act
    fixture.destroy();
    reply.next(9);
    reply.complete();

    // assert & verify
    expect(toast.success).toHaveBeenCalledWith('Rule created', '`kroger` → Kroger');
    expect(created).toBe(0);
  });

  it('should create the rule for the merchant, toast it, and say it is done', () => {
    // arrange
    create();
    settle();

    // act
    el('rule-offer-create')!.click();
    fixture.detectChanges();

    // assert & verify
    expect(ruleApi.createRule).toHaveBeenCalledWith({
      keywords: ['kroger'],
      matchType: 'OR',
      priority: 0,
      minAmount: null,
      maxAmount: null,
      merchantId: 10,
    });
    expect(toast.success).toHaveBeenCalledWith('Rule created', '`kroger` → Kroger');
    expect(created).toBe(1);
  });

  it('should fill the blank matches through create-and-apply when asked', () => {
    // arrange
    create();
    settle();

    // act
    const fill = el('rule-offer-fill') as HTMLInputElement;
    const label: string = fill.parentElement!.textContent!.trim();
    fill.click();
    fixture.detectChanges();
    el('rule-offer-create')!.click();
    fixture.detectChanges();

    // assert & verify
    expect(label).toBe('Also fill 3 blank transactions');
    expect(ruleApi.createAndApply).toHaveBeenCalledWith({
      rule: expect.objectContaining({ keywords: ['kroger'], merchantId: 10 }),
      transactionIds: [101, 102, 103],
    });
    expect(ruleApi.createRule).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(
      'Rule created',
      '`kroger` → Kroger, filled 3 transactions',
    );
  });

  it('should not offer filling when the preview does not list every blank match', () => {
    // arrange
    ruleApi.previewMatches.mockReturnValue(
      of(previewOf({ willAssignCount: 2500, willAssignIds: [101, 102] })),
    );

    // act
    create();
    settle();

    // assert & verify
    expect(el('rule-offer-fill')).toBeNull();
  });

  it('should open the rule fields on Edit and preview the edited keywords', () => {
    // arrange
    create();
    settle();

    // act
    el('rule-offer-edit')!.click();
    fixture.detectChanges();
    const keywords: HTMLInputElement = fixture.nativeElement.querySelector('#rule-keywords');
    keywords.value = 'kroger, kroger mkt';
    keywords.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    settle();

    // assert & verify
    expect(keywords.value).toBe('kroger, kroger mkt');
    expect(fixture.nativeElement.querySelector('#rule-match')).not.toBeNull();
    expect(title()).toBe('Also create rule: `kroger` + `kroger mkt` → Kroger');
    expect(ruleApi.previewMatches).toHaveBeenLastCalledWith(
      expect.objectContaining({ keywords: ['kroger', 'kroger mkt'] }),
    );
  });

  it('should not create a rule without a keyword, and open the fields to say so', () => {
    // arrange
    create();
    settle();
    component.form.controls.keywordsInput.setValue('');
    fixture.detectChanges();

    // act
    el('rule-offer-create')!.click();
    fixture.detectChanges();

    // assert & verify
    expect(ruleApi.createRule).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Enter at least one keyword.');
  });

  it('should skip on Skip or Escape, and create nothing', () => {
    // arrange
    create();

    // act
    el('rule-offer-skip')!.click();
    press(el('rule-offer')!, 'Escape');

    // assert & verify
    expect(skipped).toBe(2);
    expect(ruleApi.createRule).not.toHaveBeenCalled();
  });

  it('should create on Enter on the card, and show the refusal when the server says no', () => {
    // arrange
    ruleApi.createRule.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 400, error: { detail: 'Keyword too short.' } }),
      ),
    );
    create();
    settle();

    // act
    press(el('rule-offer')!, 'Enter');

    // assert & verify
    expect(ruleApi.createRule).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('[role=alert]')?.textContent?.trim()).toBe(
      'Keyword too short.',
    );
    expect(created).toBe(0);
  });

  it('should say the preview is on its way, and when it fails', () => {
    // arrange
    const reply = new Subject<MerchantRuleMatchPreview>();
    ruleApi.previewMatches.mockReturnValue(reply);
    create();
    settle();
    const waiting: string = fixture.nativeElement.textContent;

    // act
    reply.error(new Error('down'));
    fixture.detectChanges();

    // assert & verify
    expect(waiting).toContain('Checking what it matches…');
    expect(fixture.nativeElement.textContent).toContain("Couldn't check what it matches.");
  });
});
