import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  Category,
  CategoryCreateRequest,
  CategoryType,
  CategoryUpdateRequest,
} from '@models/category.model';
import { CATEGORY_COLORS } from '@shared/utils/category.utils';
import { CategoryEditFormComponent } from './category-edit-form.component';

const cat = (id: number, name: string, parent: Category | null = null): Category =>
  ({
    id,
    userId: 1,
    name,
    type: CategoryType.EXPENSE,
    parent,
    icon: 'pi-home',
    color: '#3B82F6',
  }) as Category;

const food = cat(1, 'Food');
const groceries = cat(2, 'Groceries', food);
const travel = cat(3, 'Travel');
const all = [food, groceries, travel];

describe('CategoryEditFormComponent', () => {
  let fixture: ComponentFixture<CategoryEditFormComponent>;
  let component: CategoryEditFormComponent;

  function render(
    category: Category | null,
    over: { defaultParentId?: number | null; blocked?: string | null } = {},
  ): void {
    fixture.componentRef.setInput('category', category);
    fixture.componentRef.setInput('categories', all);
    fixture.componentRef.setInput('defaultParentId', over.defaultParentId ?? null);
    fixture.componentRef.setInput('saving', false);
    fixture.componentRef.setInput('deleteBlockedReason', over.blocked ?? null);
    fixture.detectChanges();
  }
  const q = <T extends HTMLElement>(s: string): T => fixture.nativeElement.querySelector(s) as T;
  const button = (name: string): HTMLButtonElement | undefined =>
    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === name,
    );

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoryEditFormComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(CategoryEditFormComponent);
    component = fixture.componentInstance;
  });

  it('should fill its fields at init, before any effect or render could run after the user types', () => {
    // arrange -- inputs set, but no change detection yet (no effect has run)
    fixture.componentRef.setInput('category', groceries);
    fixture.componentRef.setInput('categories', all);

    // act
    component.ngOnInit();

    // assert & verify
    expect(component.form.getRawValue().name).toBe('Groceries');
    expect(component.form.getRawValue().parentId).toBe(1);
  });

  it('should not reset again after init when nothing relevant changed (typing survives the first render)', () => {
    // arrange
    fixture.componentRef.setInput('category', null);
    fixture.componentRef.setInput('categories', all);
    component.ngOnInit();
    component.form.patchValue({ name: 'Typed early' });

    // act -- the first render and its effects run now
    fixture.detectChanges();

    // assert & verify
    expect(component.form.getRawValue().name).toBe('Typed early');
  });

  it('should reset for another category but keep typing when the same category refreshes', () => {
    // arrange
    render(travel);
    component.form.patchValue({ name: 'TYPED' });

    // act and assert & verify
    render({ ...travel });
    expect(component.form.getRawValue().name).toBe('TYPED');
    render(groceries);
    expect(component.form.getRawValue().name).toBe('Groceries');
    expect(component.form.getRawValue().parentId).toBe(1);
  });

  it('should trim the name and emit an update with the id', () => {
    // arrange
    render(travel);
    const saved = vi.fn();
    component.save.subscribe(saved);

    // act
    component.form.patchValue({ name: '  Trips  ' });
    component.submit();

    // assert & verify
    const request = saved.mock.calls[0][0] as CategoryUpdateRequest;
    expect(request.id).toBe(3);
    expect(request.name).toBe('Trips');
    expect(request.parentId).toBeUndefined();
  });

  // PF-879: the backend clears a parent when the update leaves parentId out
  it('should omit parentId on an update that clears the parent', () => {
    // arrange
    render(groceries);
    const saved = vi.fn();
    component.save.subscribe(saved);
    expect(component.form.getRawValue().parentId).toBe(1);

    // act
    component.form.patchValue({ parentId: null });
    component.submit();

    // assert & verify
    const request = saved.mock.calls[0][0] as CategoryUpdateRequest;
    expect(request.id).toBe(2);
    expect(request.parentId).toBeUndefined();
  });

  it('should count the name length after trimming', () => {
    // arrange
    render(null);
    const saved = vi.fn();
    component.save.subscribe(saved);

    // act -- 50 characters once the padding is gone
    component.form.patchValue({ name: `  ${'x'.repeat(50)}  ` });
    component.submit();

    // assert & verify
    expect(saved).toHaveBeenCalledTimes(1);
    expect((saved.mock.calls[0][0] as CategoryCreateRequest).name).toBe('x'.repeat(50));
  });

  it('should still refuse a name longer than 50 characters once trimmed', () => {
    // arrange
    render(null);
    const saved = vi.fn();
    component.save.subscribe(saved);

    // act
    component.form.patchValue({ name: `  ${'x'.repeat(51)}  ` });
    component.submit();
    fixture.detectChanges();

    // assert & verify
    expect(saved).not.toHaveBeenCalled();
    expect(q('[data-testid="name-error"]').textContent).toContain('50 characters or fewer');
  });

  it('should emit a create request with the chosen parent, or none', () => {
    // arrange
    render(null);
    const saved = vi.fn();
    component.save.subscribe(saved);

    // act
    component.form.patchValue({ name: 'New thing' });
    component.submit();
    component.form.patchValue({ parentId: 1 });
    component.submit();

    // assert & verify
    expect((saved.mock.calls[0][0] as CategoryCreateRequest).parentId).toBeUndefined();
    expect((saved.mock.calls[1][0] as CategoryCreateRequest).parentId).toBe(1);
    expect((saved.mock.calls[1][0] as CategoryCreateRequest).type).toBe(CategoryType.EXPENSE);
  });

  it('should refuse an empty or over-long name with an inline message and send nothing', () => {
    // arrange
    render(null);
    const saved = vi.fn();
    component.save.subscribe(saved);

    // act
    component.submit();
    fixture.detectChanges();

    // assert & verify
    expect(q('[data-testid="name-error"]').textContent).toContain('Name is required.');

    // act
    component.form.patchValue({ name: 'x'.repeat(51) });
    component.submit();
    fixture.detectChanges();

    // assert & verify
    expect(q('[data-testid="name-error"]').textContent).toContain('50 characters or fewer');
    expect(saved).not.toHaveBeenCalled();
  });

  it('should refuse a duplicate name under the same parent', () => {
    // arrange
    render(null);
    const saved = vi.fn();
    component.save.subscribe(saved);

    // act
    component.form.patchValue({ name: 'groceries', parentId: 1 });
    component.submit();
    fixture.detectChanges();

    // assert & verify
    expect(saved).not.toHaveBeenCalled();
    expect(component.errorMessage()).toBe(
      'A category with this name already exists under the same parent.',
    );
  });

  it('should list only top-level categories other than itself as parents', () => {
    // act
    render(travel);

    // assert & verify
    expect(component.parentChoices().map((c) => c.name)).toEqual(['Food']);
  });

  it('should offer no parent choices to a category that has subcategories', () => {
    // act
    render(food);

    // assert & verify
    expect(component.parentChoices()).toEqual([]);
  });

  it('should pre-select defaultParentId when adding', () => {
    // act
    render(null, { defaultParentId: 1 });

    // assert & verify
    expect(component.form.getRawValue().parentId).toBe(1);
  });

  it('should pick an icon and a color, and unpick on a second click', () => {
    // arrange
    render(null);
    const color = q<HTMLButtonElement>(`[data-testid="color-1"]`);
    const icon = q<HTMLButtonElement>('[data-testid="icon-0"]');

    // act
    color.click();
    icon.click();
    fixture.detectChanges();

    // assert & verify
    expect(component.form.getRawValue().color).toBe(CATEGORY_COLORS[1]);
    expect(color.getAttribute('aria-pressed')).toBe('true');
    expect(icon.getAttribute('aria-pressed')).toBe('true');

    // act
    color.click();
    fixture.detectChanges();

    // assert & verify
    expect(color.getAttribute('aria-pressed')).toBe('false');
    expect(component.form.getRawValue().color).toBe('');
  });

  it('should disable Delete and show the reason when it is blocked', () => {
    // act
    render(travel, { blocked: 'It has 3 transactions.' });

    // assert & verify
    expect(button('Delete category')?.disabled).toBe(true);
    expect(q('[data-testid="delete-reason"]').textContent).toContain('It has 3 transactions.');
  });

  it('should emit remove and viewTransactions, and hide both in add mode', () => {
    // arrange
    render(travel);
    const removed = vi.fn();
    const viewed = vi.fn();
    component.remove.subscribe(removed);
    component.viewTransactions.subscribe(viewed);

    // act
    button('Delete category')?.click();
    button('View transactions')?.click();

    // assert & verify
    expect(removed).toHaveBeenCalledTimes(1);
    expect(viewed).toHaveBeenCalledTimes(1);

    // act
    render(null);

    // assert & verify
    expect(button('Delete category')).toBeUndefined();
    expect(button('View transactions')).toBeUndefined();
  });
});
