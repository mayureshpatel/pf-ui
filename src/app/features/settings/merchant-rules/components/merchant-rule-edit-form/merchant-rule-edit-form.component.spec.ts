import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Merchant } from '@models/merchant.model';
import { MerchantRule, MerchantRuleDraft } from '@models/merchant-rule.model';
import { MerchantRuleEditFormComponent } from './merchant-rule-edit-form.component';

const kroger = { id: 5, userId: 1, name: 'Kroger' } as Merchant;
const shell = { id: 8, userId: 1, name: 'Shell' } as Merchant;
const merchants: Merchant[] = [kroger, shell];
const rule: MerchantRule = {
  id: 9,
  userId: 1,
  keywords: ['kroger', '431'],
  matchType: 'AND',
  priority: 3,
  merchant: kroger,
  minAmount: 10,
  maxAmount: 200,
};

describe('MerchantRuleEditFormComponent', () => {
  let fixture: ComponentFixture<MerchantRuleEditFormComponent>;
  let component: MerchantRuleEditFormComponent;
  let saved: unknown[];
  let removed: number;
  let drafts: (MerchantRuleDraft | null)[];

  const el = (): HTMLElement => fixture.nativeElement;

  function render(current: MerchantRule | null = null, saving = false, initial = ''): void {
    fixture = TestBed.createComponent(MerchantRuleEditFormComponent);
    component = fixture.componentInstance;
    saved = [];
    removed = 0;
    drafts = [];
    component.draftChange.subscribe((d) => drafts.push(d));
    component.save.subscribe((v) => saved.push(v));
    component.remove.subscribe(() => removed++);
    fixture.componentRef.setInput('rule', current);
    fixture.componentRef.setInput('merchants', merchants);
    fixture.componentRef.setInput('saving', saving);
    fixture.componentRef.setInput('initialKeyword', initial);
    fixture.detectChanges();
  }

  const fill = (over: Record<string, unknown>): void =>
    component.form.patchValue({ keywordsInput: 'kroger', merchant: kroger, ...over } as never);

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MerchantRuleEditFormComponent, NoopAnimationsModule],
    });
  });

  it('should default to match any keyword, priority 0, no merchant and no limits', () => {
    // act
    render();

    // assert & verify
    expect(component.form.getRawValue()).toEqual({
      keywordsInput: '',
      matchType: 'OR',
      merchant: null,
      priority: 0,
      minAmount: null,
      maxAmount: null,
    });
  });

  it('should show the shared fields and the merchant select, labelled', () => {
    // act
    render();

    // assert & verify
    for (const id of ['rule-keywords', 'rule-match', 'rule-merchant', 'rule-priority']) {
      expect(el().querySelector(`#${id}`), id).not.toBeNull();
    }
    expect(el().querySelector('label[for="rule-merchant"]')!.textContent).toContain('Merchant');
    expect(el().querySelector('#rule-category')).toBeNull();
    expect(el().querySelectorAll('input[role="spinbutton"]').length).toBe(3);
  });

  it('should prefill an existing rule, matching its merchant by id', () => {
    // act
    render({ ...rule, merchant: { ...kroger } });

    // assert & verify
    const value = component.form.getRawValue();
    expect(value.keywordsInput).toBe('kroger, 431');
    expect(value.matchType).toBe('AND');
    expect(value.priority).toBe(3);
    expect(value.minAmount).toBe(10);
    expect(value.maxAmount).toBe(200);
    expect(value.merchant).toBe(kroger);
    expect(component.form.pristine).toBe(true);
  });

  it("should offer the rule's own merchant when the list does not hold it, without duplicating one it does", () => {
    // act
    render({ ...rule, merchant: { id: 99, userId: 1, name: 'Elsewhere' } as Merchant });
    const withOwn = component['choices']().map((m: Merchant) => m.id);
    render(rule);

    // assert & verify
    expect(withOwn).toEqual([5, 8, 99]);
    expect(component['choices']()).toHaveLength(2);
  });

  it('should be invalid without a keyword and without a merchant', () => {
    // act
    render();

    // assert & verify
    expect(component.form.controls.keywordsInput.valid).toBe(false);
    fill({ keywordsInput: ' , ' });
    expect(component.form.controls.keywordsInput.valid).toBe(false);
    fill({ keywordsInput: 'kroger', merchant: null });
    expect(component.form.controls.merchant.valid).toBe(false);
  });

  it('should ask for a merchant once the form is submitted without one', () => {
    // arrange
    render();
    fill({ merchant: null });

    // act
    component.submit();
    fixture.detectChanges();

    // assert & verify
    expect(saved).toEqual([]);
    expect(component.merchantError()).toBe('Choose a merchant.');
    expect(el().textContent).toContain('Choose a merchant.');
  });

  it('should emit the create shape with no user id', () => {
    // arrange
    render();
    fill({ keywordsInput: ' kroger, ,431,kroger ', priority: 2, minAmount: 5 });

    // act
    component.submit();

    // assert & verify
    expect(saved).toEqual([
      {
        keywords: ['kroger', '431'],
        matchType: 'OR',
        merchantId: 5,
        priority: 2,
        minAmount: 5,
        maxAmount: null,
      },
    ]);
  });

  it('should emit the update shape with the id in edit mode', () => {
    // arrange
    render(rule);
    fill({ merchant: shell });

    // act
    component.submit();

    // assert & verify
    expect(saved).toEqual([
      {
        id: 9,
        keywords: ['kroger'],
        matchType: 'AND',
        merchantId: 8,
        priority: 3,
        minAmount: 10,
        maxAmount: 200,
      },
    ]);
  });

  it('should not emit while saving or when invalid', () => {
    // arrange
    render(null, true);
    fill({});

    // act
    component.submit();
    fixture.componentRef.setInput('saving', false);
    fill({ keywordsInput: '' });
    component.submit();

    // assert & verify
    expect(saved).toEqual([]);
  });

  it('should hold the same keyword limits as category rules', () => {
    // arrange
    render();
    const many = Array.from({ length: 21 }, (_, i) => `k${i}`).join(', ');

    // act
    fill({ keywordsInput: many });
    const tooMany = component.keywordsError();
    fill({ keywordsInput: 'a'.repeat(256) });
    const tooLong = component.keywordsError();
    fill({ keywordsInput: Array.from({ length: 20 }, (_, i) => `k${i}`).join(', ') });

    // assert & verify
    expect(tooMany).toBe('Use at most 20 keywords.');
    expect(tooLong).toBe('Each keyword must be 255 characters or fewer.');
    expect(component.form.controls.keywordsInput.valid).toBe(true);
  });

  it('should reject a minimum above the maximum and negative amounts', () => {
    // arrange
    render();
    fill({});

    // act
    fill({ minAmount: 50, maxAmount: 10 });
    component.form.markAllAsTouched();
    const range = component.amountError();
    const invalidRange = component.form.invalid;
    fill({ minAmount: 10, maxAmount: 10 });
    fill({ minAmount: -1, maxAmount: null });
    component.form.markAllAsTouched();

    // assert & verify
    expect(invalidRange).toBe(true);
    expect(range).toBe("The minimum can't be more than the maximum.");
    expect(component.amountError()).toBe('Amounts must be 0 or more.');
  });

  it('should move focus to the keywords field on request', () => {
    // arrange
    render();
    document.body.appendChild(fixture.nativeElement);

    // act
    component.focusKeywords();

    // assert & verify
    expect(document.activeElement).toBe(el().querySelector('#rule-keywords'));
    fixture.nativeElement.remove();
  });

  it('should show the server message', () => {
    // arrange
    render();

    // act
    component.errorMessage.set('Nope');
    fixture.detectChanges();

    // assert & verify
    expect(el().querySelector('[role="alert"]')!.textContent).toContain('Nope');
  });

  it('should only offer Delete in edit mode, and not while saving', () => {
    // act
    render();
    const adding = el().textContent;
    render(rule);
    const editing = Array.from(el().querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Delete rule'),
    )!;
    editing.click();
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();

    // assert & verify
    expect(adding).not.toContain('Delete rule');
    expect(removed).toBe(1);
    expect(editing.disabled).toBe(true);
  });

  describe('reloaded copies of the open rule', () => {
    it('should refill a pristine form when the same rule comes back changed', () => {
      // arrange
      render(rule);

      // act
      fixture.componentRef.setInput('rule', { ...rule, keywords: ['kroger', '431', 'fuel'] });
      fixture.detectChanges();

      // assert & verify
      expect(component.form.getRawValue().keywordsInput).toBe('kroger, 431, fuel');
    });

    it('should not overwrite what the user is typing when a changed copy arrives', () => {
      // arrange
      render(rule);
      component.form.controls.keywordsInput.setValue('typing');
      component.form.markAsDirty();

      // act
      fixture.componentRef.setInput('rule', { ...rule, keywords: ['other'] });
      fixture.detectChanges();

      // assert & verify
      expect(component.form.getRawValue().keywordsInput).toBe('typing');
    });
  });

  describe('draft', () => {
    it('should emit a draft carrying the chosen merchant, and null merchant until one is chosen', () => {
      // arrange
      render();

      // act
      fill({ keywordsInput: 'kroger', merchant: null });
      fill({ merchant: shell });

      // assert & verify
      expect(drafts.at(-2)).toEqual({
        ruleId: null,
        keywords: ['kroger'],
        matchType: 'OR',
        priority: 0,
        minAmount: null,
        maxAmount: null,
        merchantId: null,
      });
      expect(drafts.at(-1)).toEqual(expect.objectContaining({ merchantId: 8 }));
    });

    it("should emit the existing rule's id and merchant when editing", () => {
      // act
      render(rule);

      // assert & verify
      expect(drafts.at(-1)).toEqual(expect.objectContaining({ ruleId: 9, merchantId: 5 }));
    });

    it('should emit null for no keywords and for keywords the server would refuse, flagging the latter', () => {
      // arrange
      render();

      // act
      const empty = drafts.at(-1);
      const emptyInvalid = component.keywordsInvalid();
      fill({ keywordsInput: Array.from({ length: 21 }, (_, i) => `k${i}`).join(', ') });

      // assert & verify
      expect(empty).toBeNull();
      expect(emptyInvalid).toBe(false);
      expect(drafts.at(-1)).toBeNull();
      expect(component.keywordsInvalid()).toBe(true);
    });

    it('should not emit duplicate consecutive drafts', () => {
      // arrange
      render();
      fill({ keywordsInput: 'kroger' });
      const count = drafts.length;

      // act
      fill({ keywordsInput: 'kroger,  kroger' });

      // assert & verify
      expect(drafts.length).toBe(count);
    });

    it('should prefill the keyword field for a new rule without making the form dirty', () => {
      // act
      render(null, false, 'KROGER #431');

      // assert & verify
      expect(component.form.getRawValue().keywordsInput).toBe('KROGER #431');
      expect(component.form.pristine).toBe(true);
    });
  });
});
