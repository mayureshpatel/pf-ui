import { vi, Mock, Mocked } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { of, Subject, throwError } from 'rxjs';
import { Confirmation, ConfirmationService } from 'primeng/api';
import { MerchantApiService } from '@features/merchants/services/merchant-api.service';
import { ToastService } from '@core/services/toast.service';
import { Merchant } from '@models/merchant.model';
import {
  MerchantRule,
  MerchantRuleChangePreview,
  MerchantRuleDraft,
  MerchantRuleMatchPreview,
} from '@models/merchant-rule.model';
import { SettingsGuard } from '../settings.guard';
import { MerchantRuleApiService } from './merchant-rule-api.service';
import { MerchantRulesComponent } from './merchant-rules.component';

const kroger = { id: 6, userId: 1, name: 'Kroger' } as Merchant;
const netflixCo = { id: 7, userId: 1, name: 'Netflix' } as Merchant;
const rule = (
  id: number,
  priority: number,
  keywords: string[],
  merchant: Merchant | null,
  over: Partial<MerchantRule> = {},
): MerchantRule => ({
  id,
  userId: 1,
  keywords,
  matchType: 'OR',
  priority,
  merchant,
  minAmount: null,
  maxAmount: null,
  ...over,
});
const netflix = rule(1, 1, ['netflix'], netflixCo);
const fuel = rule(2, 5, ['kroger fuel', 'fuelperks'], kroger, { minAmount: 10 });

const emptyPreview: MerchantRuleMatchPreview = {
  targetMerchantName: null,
  totalMatches: 0,
  willAssignCount: 0,
  losesToOtherRuleCount: 0,
  alreadyHasMerchantCount: 0,
  linkedCount: 0,
  truncated: false,
  rows: [],
};
const change: MerchantRuleChangePreview = {
  transactionId: 1,
  date: '2026-10-01T00:00:00Z',
  description: 'KROGER FUEL #12',
  amount: -40,
  accountName: 'Checking',
  merchant: kroger,
  rule: { id: 2, keywords: ['kroger fuel', 'fuelperks'], merchantName: 'Kroger', priority: 5 },
};

describe('MerchantRulesComponent', () => {
  let fixture: ComponentFixture<MerchantRulesComponent>;
  let component: MerchantRulesComponent;
  let api: Mocked<
    Pick<
      MerchantRuleApiService,
      | 'getRules'
      | 'createRule'
      | 'updateRule'
      | 'deleteRule'
      | 'previewApply'
      | 'applyRules'
      | 'previewMatches'
    >
  >;
  let getMerchants: Mock;
  let toast: Mocked<Pick<ToastService, 'success' | 'error' | 'info'>>;
  let confirmation: { confirm: Mock<(c: Confirmation) => void> };
  let guard: SettingsGuard;

  async function create(): Promise<void> {
    fixture = TestBed.createComponent(MerchantRulesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await settle();
  }
  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const text = (): string => fixture.nativeElement.textContent.replace(/\s+/g, ' ');
  const rows = (): HTMLButtonElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('[data-rule-row]'));
  const button = (label: string): HTMLButtonElement | undefined =>
    (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find(
      (b) => b.textContent?.trim() === label,
    );
  const makeDirty = (): void => {
    component['ruleForm']()!.form.controls.priority.setValue(9);
    component['ruleForm']()!.form.markAsDirty();
  };

  beforeEach(async () => {
    api = {
      getRules: vi.fn().mockReturnValue(of([netflix, fuel])),
      createRule: vi.fn().mockReturnValue(of(77)),
      updateRule: vi.fn().mockReturnValue(of(1)),
      deleteRule: vi.fn().mockReturnValue(of(undefined)),
      previewApply: vi.fn().mockReturnValue(of([change])),
      applyRules: vi.fn().mockReturnValue(of(3)),
      previewMatches: vi.fn().mockReturnValue(of(emptyPreview)),
    };
    getMerchants = vi.fn().mockReturnValue(of({ content: [kroger, netflixCo] }));
    toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    confirmation = { confirm: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [MerchantRulesComponent, NoopAnimationsModule],
      providers: [
        SettingsGuard,
        { provide: MerchantRuleApiService, useValue: api },
        { provide: MerchantApiService, useValue: { getMerchants } },
        { provide: ToastService, useValue: toast },
        { provide: ConfirmationService, useValue: confirmation },
      ],
    }).compileComponents();
    guard = TestBed.inject(SettingsGuard);
  });

  it('should show rules by priority with their keywords, merchant, limits and priority', async () => {
    // act
    await create();

    // assert & verify
    expect(rows()).toHaveLength(2);
    expect(rows()[0].textContent).toContain('kroger fuel');
    expect(rows()[0].textContent).toContain('fuelperks');
    expect(rows()[0].textContent).toContain('Kroger');
    expect(rows()[0].textContent).toContain('$10 or more');
    expect(rows()[0].textContent).toContain('Priority 5');
    expect(rows()[1].textContent).toContain('netflix');
    expect(text()).toContain('Merchant rules');
    expect(text()).toContain('2 rules');
  });

  it('should show how the keywords combine between them', async () => {
    // arrange
    api.getRules.mockReturnValue(of([rule(3, 0, ['a', 'b'], kroger, { matchType: 'AND' })]));

    // act
    await create();

    // assert & verify
    expect(rows()[0].textContent).toContain('and');
  });

  it('should load the merchants the way the import review step does', async () => {
    // act
    await create();

    // assert & verify
    expect(getMerchants).toHaveBeenCalledWith(null, { page: 0, size: 2000, sort: 'name' });
    expect(component['merchants']()).toEqual([kroger, netflixCo]);
  });

  it('should say so, and keep working, when the merchants fail to load', async () => {
    // arrange
    getMerchants.mockReturnValue(throwError(() => new Error('boom')));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // act
    await create();

    // assert & verify
    expect(toast.error).toHaveBeenCalledWith('Failed to load merchants.');
    expect(rows()).toHaveLength(2);
  });

  it('should render a rule with no merchant without throwing', async () => {
    // arrange
    api.getRules.mockReturnValue(of([rule(3, 0, ['starbucks'], null)]));

    // act
    await create();

    // assert & verify
    expect(rows()[0].textContent).toContain('No merchant');
  });

  it('should open a rule in the panel and return to overview on Back and Close', async () => {
    // arrange
    await create();

    // act
    rows()[0].click();
    await settle();
    const opened = {
      mode: component['panelMode'](),
      title: fixture.nativeElement.querySelector('aside h2').textContent.trim(),
    };
    button('Back to overview')!.click();
    await settle();
    const afterBack = component['panelMode']();
    rows()[1].click();
    await settle();
    component.onPanelClose();
    await settle();

    // assert & verify
    expect(opened).toEqual({ mode: 'rule', title: 'Edit rule' });
    expect(afterBack).toBe('overview');
    expect(component['panelMode']()).toBe('overview');
  });

  it('should filter by keyword and merchant name and say when nothing matches', async () => {
    // arrange
    await create();
    const search = (value: string): void => {
      const input: HTMLInputElement = fixture.nativeElement.querySelector('#rules-search');
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };

    // act
    search('fuelp');
    const byKeyword = rows().length;
    search('netfl');
    const byMerchant = rows().length;
    search('zzz');
    const none = text();
    button('Clear search')!.click();
    fixture.detectChanges();

    // assert & verify
    expect(byKeyword).toBe(1);
    expect(byMerchant).toBe(1);
    expect(none).toContain('No rules match');
    expect(rows()).toHaveLength(2);
  });

  it('should explain itself when there are no rules', async () => {
    // arrange
    api.getRules.mockReturnValue(of([]));

    // act
    await create();

    // assert & verify
    expect(text()).toContain('No rules yet');
    expect(component['panelMode']()).toBe('add');
    expect(button('Back')).toBeUndefined();
  });

  it('should save an edited rule with its id and merchant, keep it open and say so', async () => {
    // arrange
    await create();
    rows()[0].click();
    await settle();
    makeDirty();

    // act
    component.onPanelSave();
    await settle();

    // assert & verify
    expect(api.updateRule).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, priority: 9, merchantId: 6 }),
    );
    expect(toast.success).toHaveBeenCalledWith('Rule saved');
    expect(component['panelMode']()).toBe('rule');
    expect(component['selectedRuleId']()).toBe(2);
    expect(api.getRules).toHaveBeenCalledTimes(2);
    expect(guard.dirty()).toBe(false);
  });

  it('should add a rule, open it and say so', async () => {
    // arrange
    await create();
    button('Add rule')!.click();
    await settle();
    component['ruleForm']()!.form.patchValue({ keywordsInput: 'costco, sams', merchant: kroger });
    api.getRules.mockReturnValue(of([netflix, fuel, rule(77, 0, ['costco', 'sams'], kroger)]));

    // act
    component.onPanelSave();
    await settle();

    // assert & verify
    expect(api.createRule).toHaveBeenCalledWith({
      keywords: ['costco', 'sams'],
      matchType: 'OR',
      merchantId: 6,
      priority: 0,
      minAmount: null,
      maxAmount: null,
    });
    expect(toast.success).toHaveBeenCalledWith('Rule added');
    expect(component['selectedRuleId']()).toBe(77);
    expect(component['panelMode']()).toBe('rule');
  });

  it('should not send a rule without a merchant', async () => {
    // arrange
    await create();
    button('Add rule')!.click();
    await settle();
    component['ruleForm']()!.form.patchValue({ keywordsInput: 'costco' });

    // act
    component.onPanelSave();
    await settle();

    // assert & verify
    expect(api.createRule).not.toHaveBeenCalled();
    expect(text()).toContain('Choose a merchant.');
  });

  it('should not send a second create while the reload after an add is pending', async () => {
    // arrange
    await create();
    button('Add rule')!.click();
    await settle();
    component['ruleForm']()!.form.patchValue({ keywordsInput: 'costco', merchant: kroger });
    api.getRules.mockReturnValue(new Subject<MerchantRule[]>());

    // act
    component.onPanelSave();
    await settle();
    component.onPanelSave();
    await settle();

    // assert & verify
    expect(api.createRule).toHaveBeenCalledTimes(1);
    expect(component['panelMode']()).toBe('rule');
  });

  it('should show the server message and stay when saving fails', async () => {
    // arrange
    await create();
    rows()[0].click();
    await settle();
    api.updateRule.mockReturnValue(
      throwError(() => ({ status: 400, error: { detail: 'Too many keywords' } })),
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    makeDirty();

    // act
    component.onPanelSave();
    await settle();

    // assert & verify
    expect(text()).toContain('Too many keywords');
    expect(component['panelMode']()).toBe('rule');
    expect(guard.dirty()).toBe(true);
  });

  it('should say the rule no longer exists when saving one deleted elsewhere', async () => {
    // arrange
    await create();
    rows()[0].click();
    await settle();
    api.updateRule.mockReturnValue(throwError(() => ({ status: 404, error: {} })));
    api.getRules.mockReturnValue(of([netflix]));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    makeDirty();

    // act
    component.onPanelSave();
    await settle();

    // assert & verify
    expect(toast.info).toHaveBeenCalledWith('That rule no longer exists.');
    expect(rows()).toHaveLength(1);
    expect(component['panelMode']()).toBe('overview');
  });

  it('should ask before discarding a dirty form on every route', async () => {
    // arrange
    await create();
    const routes: [string, () => void][] = [
      ['another row', () => rows()[1].click()],
      ['add', () => component.startAdd()],
      ['back', () => component.back()],
      ['close', () => component.onPanelClose()],
    ];

    for (const [name, go] of routes) {
      // act
      rows()[0].click();
      await settle();
      makeDirty();
      confirmation.confirm.mockClear();
      go();

      // assert & verify
      expect(confirmation.confirm, name).toHaveBeenCalledTimes(1);
      expect(confirmation.confirm.mock.calls[0][0].header).toBe('Discard changes?');
      confirmation.confirm.mock.calls[0][0].accept!();
      await settle();
      component.back();
      confirmation.confirm.mock.calls.at(-1)?.[0].accept?.();
      await settle();
    }
  });

  it('should tell the settings host when the form is dirty', async () => {
    // arrange
    await create();
    rows()[0].click();
    await settle();

    // act
    const clean = guard.dirty();
    makeDirty();

    // assert & verify
    expect(clean).toBe(false);
    expect(guard.dirty()).toBe(true);
  });

  it('should stop telling the settings host once it is destroyed', async () => {
    // arrange
    await create();
    rows()[0].click();
    await settle();
    makeDirty();

    // act
    fixture.destroy();

    // assert & verify
    expect(guard.dirty()).toBe(false);
  });

  it('should ask before deleting and remove the rule', async () => {
    // arrange
    await create();
    rows()[0].click();
    await settle();
    api.getRules.mockReturnValue(of([netflix]));

    // act
    button('Delete rule')!.click();
    const asked = confirmation.confirm.mock.calls[0][0];
    asked.accept!();
    await settle();

    // assert & verify
    expect(asked.message).toContain('kroger fuel');
    expect(api.deleteRule).toHaveBeenCalledWith(2);
    expect(toast.success).toHaveBeenCalledWith('Rule deleted');
    expect(component['panelMode']()).toBe('overview');
    expect(rows()).toHaveLength(1);
  });

  it("should show the server's message and keep the rule when delete is refused", async () => {
    // arrange
    await create();
    rows()[0].click();
    await settle();
    api.deleteRule.mockReturnValue(throwError(() => ({ error: { detail: 'Rule is in use.' } })));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // act
    button('Delete rule')!.click();
    confirmation.confirm.mock.calls[0][0].accept!();
    await settle();

    // assert & verify
    expect(toast.error).toHaveBeenCalledWith('Rule is in use.');
    expect(component['panelMode']()).toBe('rule');
    expect(rows()).toHaveLength(2);
  });

  it('should show a skeleton on the first load and dim on a reload', async () => {
    // arrange
    const first = new Subject<MerchantRule[]>();
    api.getRules.mockReturnValue(first);
    fixture = TestBed.createComponent(MerchantRulesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // act
    const skeleton = fixture.nativeElement.querySelector('p-skeleton');
    first.next([netflix, fuel]);
    first.complete();
    await settle();
    api.getRules.mockReturnValue(new Subject<MerchantRule[]>());
    component.loadRules();
    await settle();

    // assert & verify
    expect(skeleton).not.toBeNull();
    expect(fixture.nativeElement.querySelector('p-skeleton')).toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(rows()).toHaveLength(2);
  });

  it('should show the error state, with a retry, when the first load fails', async () => {
    // arrange
    api.getRules.mockReturnValue(throwError(() => new Error('boom')));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // act
    await create();

    // assert & verify
    expect(fixture.debugElement.query(By.css('app-page-error-state'))).not.toBeNull();
    expect(toast.error).toHaveBeenCalledWith('Failed to load merchant rules.');
    expect(component['rules']()).toEqual([]);
  });

  it('should keep the open form, with a retry line, when a reload fails', async () => {
    // arrange
    await create();
    rows()[0].click();
    await settle();
    api.getRules.mockReturnValue(throwError(() => new Error('boom')));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // act
    component.loadRules();
    await settle();

    // assert & verify
    expect(fixture.nativeElement.querySelector('[data-testid="reload-failed"]')).not.toBeNull();
    expect(component['panelMode']()).toBe('rule');
    expect(rows()).toHaveLength(2);
  });

  it('should return to overview with a toast when the shown rule vanished', async () => {
    // arrange
    await create();
    rows()[0].click();
    await settle();
    api.getRules.mockReturnValue(of([netflix]));

    // act
    component.loadRules();
    await settle();

    // assert & verify
    expect(toast.info).toHaveBeenCalledWith('That rule no longer exists.');
    expect(component['panelMode']()).toBe('overview');
  });

  describe('apply', () => {
    it('should preview the changes with the merchant and the deciding rule, then apply and say how many', async () => {
      // arrange
      await create();

      // act
      button('Apply rules')!.click();
      await settle();
      const items = component['previewItems']();
      const shown = component['showApplyDialog']();
      const dialog = text();
      component.confirmApply();
      await settle();

      // assert & verify
      expect(shown).toBe(true);
      expect(items).toEqual([
        {
          description: 'KROGER FUEL #12',
          oldValue: '',
          newValue: 'Kroger',
          decidedBy: 'a rule with keywords "kroger fuel", "fuelperks" (priority 5)',
        },
      ]);
      expect(dialog).toContain('Apply Merchant Rules');
      expect(dialog).toContain('Decided by');
      expect(api.applyRules).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('3 transactions got a merchant.');
      expect(component['showApplyDialog']()).toBe(false);
    });

    it('should say "1 transaction" for a single change', async () => {
      // arrange
      api.applyRules.mockReturnValue(of(1));
      await create();

      // act
      component.confirmApply();

      // assert & verify
      expect(toast.success).toHaveBeenCalledWith('1 transaction got a merchant.');
    });

    it('should say when no transaction would change', async () => {
      // arrange
      api.previewApply.mockReturnValue(of([]));
      await create();

      // act
      component.openApplyPreview();

      // assert & verify
      expect(toast.info).toHaveBeenCalledWith(
        'No transactions without a merchant match your current rules.',
      );
      expect(component['showApplyDialog']()).toBe(false);
    });

    it("should show the server's message when the preview or the apply fails", async () => {
      // arrange
      await create();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      api.previewApply.mockReturnValue(throwError(() => ({ error: { detail: 'No preview' } })));

      // act
      component.openApplyPreview();
      api.applyRules.mockReturnValue(throwError(() => ({ error: {} })));
      component.confirmApply();

      // assert & verify
      expect(toast.error).toHaveBeenCalledWith('No preview');
      expect(toast.error).toHaveBeenCalledWith('Failed to apply rules.');
      expect(component['showApplyDialog']()).toBe(false);
    });
  });

  it('should move focus into the panel and back to the opener', async () => {
    // arrange
    await create();
    document.body.appendChild(fixture.nativeElement);
    const opener = rows()[0];
    opener.focus();

    // act
    opener.click();
    await settle();
    await new Promise((resolve) => setTimeout(resolve));
    const inPanel = document.activeElement?.tagName;
    button('Back to overview')!.click();
    await settle();
    await new Promise((resolve) => setTimeout(resolve));

    // assert & verify
    expect(inPanel).toBe('ASIDE');
    expect(document.activeElement).toBe(rows()[0]);
    fixture.nativeElement.remove();
  });

  describe('match list', () => {
    const matchList = (): HTMLElement | null =>
      fixture.nativeElement.querySelector('app-rule-match-list');
    const lastDraft = (): MerchantRuleDraft | undefined =>
      api.previewMatches.mock.calls[api.previewMatches.mock.calls.length - 1]?.[0];
    /** the match list's 300 ms debounce, run on fake timers installed before the draft changes */
    const elapse = (): void => {
      fixture.detectChanges();
      vi.advanceTimersByTime(300);
      fixture.detectChanges();
    };

    afterEach(() => vi.useRealTimers());

    it('should preview a new draft with the chosen merchant, in merchant wording', async () => {
      // arrange
      await create();
      button('Add rule')!.click();
      await settle();
      vi.useFakeTimers();
      api.previewMatches.mockReturnValue(
        of({
          ...emptyPreview,
          targetMerchantName: 'Kroger',
          totalMatches: 1,
          willAssignCount: 1,
          rows: [
            {
              transactionId: 4,
              date: '2026-10-05T00:00:00Z',
              description: 'KROGER #431',
              amount: -20,
              accountName: 'Checking',
              currentMerchant: null,
              verdict: 'WILL_ASSIGN',
              otherRules: [],
              winningRule: null,
            },
          ],
        } as MerchantRuleMatchPreview),
      );

      // act
      component['ruleForm']()!.form.patchValue({ keywordsInput: 'kroger', merchant: kroger });
      elapse();
      fixture.detectChanges();

      // assert & verify
      expect(lastDraft()).toEqual(
        expect.objectContaining({ ruleId: null, keywords: ['kroger'], merchantId: 6 }),
      );
      expect(matchList()!.textContent).toContain('will be assigned to Kroger');
      expect(matchList()!.textContent).toContain('Will be assigned to Kroger');
    });

    it("should show the match list while editing and send the edited rule's id", async () => {
      // arrange
      await create();
      vi.useFakeTimers();

      // act
      rows()[0].click();
      elapse();

      // assert & verify -- the sort puts the priority-5 rule first
      expect(matchList()).not.toBeNull();
      expect(lastDraft()).toEqual(
        expect.objectContaining({
          ruleId: 2,
          keywords: ['kroger fuel', 'fuelperks'],
          merchantId: 6,
        }),
      );
    });

    it('should ask to fix the keywords, sending nothing, when there are too many', async () => {
      // arrange
      await create();
      button('Add rule')!.click();
      await settle();
      vi.useFakeTimers();
      const before = api.previewMatches.mock.calls.length;

      // act
      component['ruleForm']()!.form.patchValue({
        keywordsInput: Array.from({ length: 21 }, (_, i) => `k${i}`).join(', '),
      });
      elapse();

      // assert & verify
      expect(matchList()!.textContent).toContain('Fix the keywords to see matches');
      expect(api.previewMatches.mock.calls.length).toBe(before);
    });

    it('should clear the draft when the panel closes', async () => {
      // arrange
      await create();
      rows()[0].click();
      await settle();
      expect(component['draft']()).not.toBeNull();

      // act
      button('Back to overview')!.click();
      await settle();

      // assert & verify
      expect(component['draft']()).toBeNull();
      expect(matchList()).toBeNull();
    });
  });
});
