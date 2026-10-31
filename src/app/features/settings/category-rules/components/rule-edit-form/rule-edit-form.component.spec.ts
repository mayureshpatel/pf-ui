import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Category, CategoryGroup } from '@models/category.model';
import { CategoryRule } from '@models/category-rule.model';
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

  function render(current: CategoryRule | null = null, saving = false): void {
    fixture = TestBed.createComponent(RuleEditFormComponent);
    component = fixture.componentInstance;
    saved = [];
    removed = 0;
    component.save.subscribe((v) => saved.push(v));
    component.remove.subscribe(() => removed++);
    fixture.componentRef.setInput('rule', current);
    fixture.componentRef.setInput('groups', groups);
    fixture.componentRef.setInput('saving', saving);
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
});
