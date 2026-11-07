import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Category, CategoryGroup } from '@models/category.model';
import { CategoryRule, RuleDraft } from '@models/category-rule.model';
import { RuleEditFormComponent } from './rule-edit-form.component';

const food = { id: 5, name: 'Food' } as Category;
const groceries = { id: 8, name: 'Groceries', parent: food } as Category;
const groups: CategoryGroup[] = [{ parent: food, items: [groceries] }];
const rule: CategoryRule = {
  id: 9,
  userId: 1,
  keywords: ['whole foods', 'kroger'],
  matchType: 'AND',
  priority: 3,
  category: groceries,
  minAmount: 10,
  maxAmount: 200,
};

describe('RuleEditFormComponent', () => {
  let fixture: ComponentFixture<RuleEditFormComponent>;
  let component: RuleEditFormComponent;
  let saved: unknown[];
  let removed: number;
  let drafts: (RuleDraft | null)[];

  function render(current: CategoryRule | null = null, saving = false, initial = ''): void {
    fixture = TestBed.createComponent(RuleEditFormComponent);
    component = fixture.componentInstance;
    saved = [];
    removed = 0;
    drafts = [];
    component.draftChange.subscribe((d) => drafts.push(d));
    component.save.subscribe((v) => saved.push(v));
    component.remove.subscribe(() => removed++);
    fixture.componentRef.setInput('rule', current);
    fixture.componentRef.setInput('groups', groups);
    fixture.componentRef.setInput('saving', saving);
    fixture.componentRef.setInput('initialKeyword', initial);
    fixture.detectChanges();
  }

  const fill = (over: Record<string, unknown>): void =>
    component.form.patchValue({ keywordsInput: 'netflix', category: groceries, ...over } as never);

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [RuleEditFormComponent, NoopAnimationsModule] });
  });

  it('should default to match any keyword, priority 0 and no limits', () => {
    // act
    render();

    // assert & verify
    expect(component.form.getRawValue()).toEqual({
      keywordsInput: '',
      matchType: 'OR',
      category: null,
      priority: 0,
      minAmount: null,
      maxAmount: null,
    });
  });

  it('should prefill an existing rule, matching its category by id', () => {
    // act
    render(rule);

    // assert & verify
    const value = component.form.getRawValue();
    expect(value.keywordsInput).toBe('whole foods, kroger');
    expect(value.matchType).toBe('AND');
    expect(value.priority).toBe(3);
    expect(value.minAmount).toBe(10);
    expect(value.maxAmount).toBe(200);
    expect(value.category?.id).toBe(8);
    expect(component.form.pristine).toBe(true);
  });

  it("should offer the rule's own category when it is not in the grouped list (a parent category)", () => {
    // arrange
    const parentRule: CategoryRule = { ...rule, category: food };

    // act
    render(parentRule);
    const options = component['choices']().flatMap((g: CategoryGroup) =>
      g.items.map((c: Category) => c.id),
    );

    // assert & verify
    expect(options).toContain(5);
    expect(options).toContain(8);
    expect(component.form.getRawValue().category?.id).toBe(5);
  });

  it("should not add a duplicate option when the rule's category is already listed", () => {
    // act
    render(rule);

    // assert & verify
    expect(component['choices']()).toHaveLength(1);
  });

  it('should refill and become pristine when another rule is shown', () => {
    // arrange
    render(rule);
    component.form.controls.keywordsInput.setValue('changed');
    component.form.markAsDirty();

    // act
    fixture.componentRef.setInput('rule', { ...rule, id: 10, keywords: ['shell'] });
    fixture.detectChanges();

    // assert & verify
    expect(component.form.getRawValue().keywordsInput).toBe('shell');
    expect(component.form.pristine).toBe(true);
  });

  it('should be invalid without a keyword and without a category', () => {
    // act
    render();

    // assert & verify
    expect(component.form.controls.keywordsInput.valid).toBe(false);
    fill({ keywordsInput: ' , ' });
    expect(component.form.controls.keywordsInput.valid).toBe(false);
    fill({ keywordsInput: 'netflix', category: null });
    expect(component.form.controls.category.valid).toBe(false);
  });

  it('should drop blank keywords and duplicates on submit', () => {
    // arrange
    render();
    fill({ keywordsInput: ' netflix, ,spotify,netflix ' });

    // act
    component.submit();

    // assert & verify
    expect(saved).toEqual([
      {
        keywords: ['netflix', 'spotify'],
        matchType: 'OR',
        categoryId: 8,
        priority: 0,
        minAmount: null,
        maxAmount: null,
      },
    ]);
  });

  it('should flag a keyword over 255 characters', () => {
    // arrange
    render();

    // act
    fill({ keywordsInput: 'a'.repeat(256) });
    component.form.controls.keywordsInput.markAsTouched();
    fixture.detectChanges();

    // assert & verify
    expect(component.form.controls.keywordsInput.valid).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('255 characters or fewer');
    fill({ keywordsInput: 'a'.repeat(255) });
    expect(component.form.controls.keywordsInput.valid).toBe(true);
  });

  it('should allow at most 20 keywords', () => {
    // arrange
    render();
    const many = (n: number): string => Array.from({ length: n }, (_, i) => `k${i}`).join(', ');

    // act
    fill({ keywordsInput: many(21) });
    component.form.controls.keywordsInput.markAsTouched();
    fixture.detectChanges();

    // assert & verify
    expect(component.form.controls.keywordsInput.valid).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Use at most 20 keywords.');
    fill({ keywordsInput: many(20) });
    expect(component.form.controls.keywordsInput.valid).toBe(true);
  });

  it('should say why the keywords are refused while still typing, not only after leaving the field', () => {
    // arrange
    render();
    const many = (n: number): string => Array.from({ length: n }, (_, i) => `k${i}`).join(', ');
    const field = (): HTMLInputElement => fixture.nativeElement.querySelector('#rule-keywords');
    const message = (): HTMLElement => fixture.nativeElement.querySelector('#rule-keywords-error');
    const type = (value: string): void => {
      field().value = value;
      field().dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };

    // act -- typing, focus never leaves the field
    type(many(21));

    // assert & verify
    expect(component.form.controls.keywordsInput.touched).toBe(false);
    expect(message().textContent?.trim()).toBe('Use at most 20 keywords.');
    expect(message().getAttribute('aria-live')).toBe('polite');
    expect(field().getAttribute('aria-describedby')).toContain('rule-keywords-error');
    const observer = new MutationObserver(() => undefined);
    observer.observe(message(), { childList: true, characterData: true, subtree: true });

    // act -- another keystroke with the same reason does not rewrite (re-announce) the message
    type(many(22));

    // assert & verify
    expect(message().textContent?.trim()).toBe('Use at most 20 keywords.');
    expect(observer.takeRecords().length).toBe(0);
    observer.disconnect();

    // act -- a keyword over the length limit
    type('a'.repeat(256));

    // assert & verify
    expect(message().textContent?.trim()).toBe('Each keyword must be 255 characters or fewer.');

    // act -- merely empty says nothing until the field is left
    type('');

    // assert & verify
    expect(message().textContent?.trim()).toBe('');
    field().dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(message().textContent?.trim()).toBe('Enter at least one keyword.');
  });

  it('should reject a negative priority and negative amounts', () => {
    // arrange
    render();

    // act
    fill({ priority: -1, minAmount: -5, maxAmount: -1 });

    // assert & verify
    expect(component.form.controls.priority.valid).toBe(false);
    expect(component.form.controls.minAmount.valid).toBe(false);
    expect(component.form.controls.maxAmount.valid).toBe(false);
  });

  it('should reject a minimum above the maximum and accept equal and zero bounds', () => {
    // arrange
    render();

    // act
    fill({ minAmount: 10, maxAmount: 5 });
    const above = component.form.valid;
    component.form.markAllAsTouched();
    fixture.detectChanges();
    const message = fixture.nativeElement.textContent;
    fill({ minAmount: 5, maxAmount: 5 });
    const equal = component.form.valid;
    fill({ minAmount: 0, maxAmount: 0 });
    const zero = component.form.valid;

    // assert & verify
    expect(above).toBe(false);
    expect(message).toContain("The minimum can't be more than the maximum.");
    expect(equal).toBe(true);
    expect(zero).toBe(true);
  });

  it('should emit the update shape with the id in edit mode', () => {
    // arrange
    render(rule);
    component.form.controls.priority.setValue(7);

    // act
    component.submit();

    // assert & verify
    expect(saved).toEqual([
      {
        id: 9,
        keywords: ['whole foods', 'kroger'],
        matchType: 'AND',
        categoryId: 8,
        priority: 7,
        minAmount: 10,
        maxAmount: 200,
      },
    ]);
  });

  it('should not emit while saving or when invalid', () => {
    // arrange
    render(rule, true);

    // act
    component.submit();
    render();
    component.submit();

    // assert & verify
    expect(saved).toEqual([]);
    expect(component.form.controls.keywordsInput.touched).toBe(true);
  });

  it('should move focus to the keywords field on request', () => {
    // arrange
    render(null, false, 'NETFLIX.COM');
    document.body.appendChild(fixture.nativeElement);

    // act
    component.focusKeywords();

    // assert & verify
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('#rule-keywords'));
    fixture.nativeElement.remove();
  });

  it('should show the server message', () => {
    // arrange
    render(rule);

    // act
    component.errorMessage.set('Rule not found.');
    fixture.detectChanges();

    // assert & verify
    expect(fixture.nativeElement.textContent).toContain('Rule not found.');
  });

  it('should only offer Delete in edit mode', () => {
    // act
    render();
    const add = fixture.nativeElement.textContent;
    render(rule);
    const button = Array.from(fixture.nativeElement.querySelectorAll('button')).find((b) =>
      (b as HTMLElement).textContent?.includes('Delete rule'),
    ) as HTMLButtonElement;
    button.click();

    // assert & verify
    expect(add).not.toContain('Delete rule');
    expect(removed).toBe(1);
  });

  // PF-890
  describe('reloaded copies of the open rule', () => {
    it('should refill a pristine form when the same rule comes back changed', () => {
      // arrange
      render(rule);

      // act -- edited elsewhere, or the keywords normalised by the save
      fixture.componentRef.setInput('rule', {
        ...rule,
        keywords: ['kroger', 'whole foods'],
        priority: 4,
      });
      fixture.detectChanges();

      // assert & verify
      expect(component.form.getRawValue().keywordsInput).toBe('kroger, whole foods');
      expect(component.form.getRawValue().priority).toBe(4);
      expect(component.form.pristine).toBe(true);
    });

    it('should not overwrite what the user is typing when a changed copy arrives', () => {
      // arrange
      render(rule);
      component.form.controls.keywordsInput.setValue('my edit');
      component.form.markAsDirty();

      // act
      fixture.componentRef.setInput('rule', { ...rule, priority: 4 });
      fixture.detectChanges();

      // assert & verify
      expect(component.form.getRawValue().keywordsInput).toBe('my edit');
      expect(component.form.getRawValue().priority).toBe(3);
    });

    it('should leave the form alone when an identical copy arrives', () => {
      // arrange
      render(rule);
      const before = component.form.getRawValue();

      // act
      fixture.componentRef.setInput('rule', { ...rule });
      fixture.detectChanges();

      // assert & verify
      expect(component.form.getRawValue()).toEqual(before);
    });
  });

  it('should stop a priority above the server integer', () => {
    // arrange
    render();
    fill({ priority: 2147483647 });
    component.submit();
    expect(saved).toHaveLength(1);

    // act
    fill({ priority: 2147483648 });
    component.submit();
    fixture.detectChanges();

    // assert & verify
    expect(saved).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('Priority must be 2,147,483,647 or less.');
  });

  it('should disable Delete while a save is in flight', () => {
    // act
    render(rule, true);

    // assert & verify
    const del = (
      Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]
    ).find((b) => b.textContent?.includes('Delete rule'))!;
    expect(del.disabled).toBe(true);
  });

  describe('draft', () => {
    const last = (): RuleDraft | null => drafts[drafts.length - 1];

    it('should emit a draft as keywords, match type, priority and range change', () => {
      // arrange
      render();

      // act
      component.form.patchValue({ keywordsInput: ' costco , , gas ' });
      component.form.patchValue({ matchType: 'AND' });
      component.form.patchValue({ priority: 4 });
      component.form.patchValue({ minAmount: 5, maxAmount: 50 });

      // assert & verify
      expect(last()).toEqual({
        ruleId: null,
        keywords: ['costco', 'gas'],
        matchType: 'AND',
        priority: 4,
        minAmount: 5,
        maxAmount: 50,
      });
    });

    it('should emit null for an empty keyword list', () => {
      // arrange
      render();
      component.form.patchValue({ keywordsInput: 'costco' });
      expect(last()).not.toBeNull();

      // act
      component.form.patchValue({ keywordsInput: ' , ' });

      // assert & verify
      expect(last()).toBeNull();
      expect(drafts[0]).toBeNull();
    });

    it('should emit null and flag the keywords as invalid for more than 20 keywords', () => {
      // arrange
      render();
      component.form.patchValue({ keywordsInput: 'costco' });
      expect(last()).not.toBeNull();
      expect(component.keywordsInvalid()).toBe(false);

      // act
      component.form.patchValue({
        keywordsInput: Array.from({ length: 21 }, (_, i) => `k${i}`).join(', '),
      });

      // assert & verify
      expect(last()).toBeNull();
      expect(component.keywordsInvalid()).toBe(true);
    });

    it('should emit null and flag the keywords as invalid for a keyword over 255 characters', () => {
      // arrange
      render();
      component.form.patchValue({ keywordsInput: 'costco' });

      // act
      component.form.patchValue({ keywordsInput: `costco, ${'a'.repeat(256)}` });

      // assert & verify
      expect(last()).toBeNull();
      expect(component.keywordsInvalid()).toBe(true);
    });

    it('should emit null when editing a rule that has more than 20 keywords', () => {
      // act
      render({ ...rule, keywords: Array.from({ length: 21 }, (_, i) => `k${i}`) });

      // assert & verify
      expect(drafts.every((d) => d === null)).toBe(true);
      expect(component.keywordsInvalid()).toBe(true);
    });

    it('should not flag an empty keyword field as invalid input', () => {
      // act
      render();
      component.form.patchValue({ keywordsInput: ' , ' });

      // assert & verify
      expect(last()).toBeNull();
      expect(component.keywordsInvalid()).toBe(false);
    });

    it('should prefill the keyword field for a new rule and ignore initialKeyword when editing', () => {
      // act
      render(null, false, 'COSTCO');

      // assert & verify
      expect(component.form.controls.keywordsInput.value).toBe('COSTCO');
      expect(component.form.dirty).toBe(false);
      expect(last()?.keywords).toEqual(['COSTCO']);

      // act
      render(rule, false, 'COSTCO');

      // assert & verify
      expect(component.form.controls.keywordsInput.value).toBe('whole foods, kroger');
      expect(last()?.keywords).toEqual(['whole foods', 'kroger']);
    });

    it("should emit the existing rule's id when editing", () => {
      // act
      render(rule);

      // assert & verify
      expect(last()).toEqual({
        ruleId: 9,
        keywords: ['whole foods', 'kroger'],
        matchType: 'AND',
        priority: 3,
        minAmount: 10,
        maxAmount: 200,
      });
    });

    it('should not emit duplicate consecutive drafts', () => {
      // arrange
      render();
      component.form.patchValue({ keywordsInput: 'costco' });
      const count = drafts.length;

      // act -- same draft again, and a change that is not part of it
      component.form.patchValue({ keywordsInput: ' costco ' });
      component.form.patchValue({ category: groceries });

      // assert & verify
      expect(drafts).toHaveLength(count);
    });
  });

  it('should tell the host which category is chosen, so the preview can say what rows would become (PF-926)', () => {
    // arrange
    render();
    const names: (string | null)[] = [];
    component.categoryChange.subscribe((name) => names.push(name));

    // act
    component.form.patchValue({ category: groceries });
    component.form.patchValue({ category: null });

    // assert & verify
    expect(names).toEqual(['Groceries', null]);
  });
});
