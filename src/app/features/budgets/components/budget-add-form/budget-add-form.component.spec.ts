import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Category } from '@models/category.model';
import { BudgetAddFormComponent } from './budget-add-form.component';

const cat = (id: number, name: string, parent: Category | null = null): Category =>
  ({ id, name, parent, icon: 'pi-tag', color: '#10b981' }) as unknown as Category;

describe('BudgetAddFormComponent', () => {
  let fixture: ComponentFixture<BudgetAddFormComponent>;
  let component: BudgetAddFormComponent;
  const food = cat(1, 'Food');
  const groceries = cat(2, 'Groceries', food);

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [BudgetAddFormComponent] }).compileComponents();
    fixture = TestBed.createComponent(BudgetAddFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('categories', [food, groceries, cat(3, 'Travel')]);
    fixture.detectChanges();
  });

  it('should group parents under Main categories and children under their parent', () => {
    // assert & verify
    const groups = component.categoryGroups();
    expect(groups.map((g) => g.label)).toEqual(['Main categories', 'Food subcategories']);
    expect(groups[0].items.map((i) => i.label)).toEqual(['Food', 'Travel']);
    expect(groups[1].items.map((i) => i.label)).toEqual(['Groceries']);
  });

  it('should emit the category and amount once valid, accepting zero', () => {
    // arrange
    const saved = vi.fn();
    component.save.subscribe(saved);

    // act
    component.form.patchValue({ categoryId: 2, amount: 0 });
    component.submit();

    // assert & verify
    expect(saved).toHaveBeenCalledWith({ categoryId: 2, amount: 0 });
  });

  it('should send nothing and say what is missing when incomplete or negative', () => {
    // arrange
    const saved = vi.fn();
    component.save.subscribe(saved);

    // act
    component.submit();
    component.form.patchValue({ categoryId: 2, amount: -5 });
    component.submit();
    fixture.detectChanges();

    // assert & verify
    expect(saved).not.toHaveBeenCalled();
    expect(
      fixture.nativeElement.querySelector('[data-testid="amount-error"]').textContent,
    ).toContain('Enter an amount of $0 or more.');
    component.form.patchValue({ categoryId: null, amount: 5 });
    component.submit();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-testid="category-error"]').textContent,
    ).toContain('Choose a category.');
  });

  it('should explain when every category already has a budget and send nothing', () => {
    // arrange
    fixture.componentRef.setInput('categories', []);
    fixture.detectChanges();
    const saved = vi.fn();
    component.save.subscribe(saved);

    // act
    component.form.patchValue({ categoryId: 2, amount: 10 });
    component.submit();

    // assert & verify
    expect(fixture.nativeElement.textContent).toContain(
      'Every category already has a budget this month.',
    );
    expect(saved).not.toHaveBeenCalled();
  });
});
