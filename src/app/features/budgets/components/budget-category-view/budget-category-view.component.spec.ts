import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BudgetStatus } from '@models/budget.model';
import { Category } from '@models/category.model';
import { BudgetRow } from '../../utils/budget-helpers';
import { BudgetCategoryViewComponent } from './budget-category-view.component';

const row = (
  id: number,
  budgeted: number,
  spent: number,
  budgetId: number | null = 9,
): BudgetRow => ({
  budgetId,
  status: {
    category: {
      id,
      name: 'Groceries',
      parent: null,
      icon: 'pi-shopping-cart',
      color: '#10b981',
    } as unknown as Category,
    budgetedAmount: budgeted,
    spentAmount: spent,
    remainingAmount: budgeted - spent,
    percentageUsed: 0,
  } as BudgetStatus,
});

describe('BudgetCategoryViewComponent', () => {
  let fixture: ComponentFixture<BudgetCategoryViewComponent>;
  let component: BudgetCategoryViewComponent;
  const render = (r: BudgetRow, saving = false): void => {
    fixture.componentRef.setInput('row', r);
    fixture.componentRef.setInput('monthName', 'October');
    fixture.componentRef.setInput('saving', saving);
    fixture.detectChanges();
  };
  const button = (name: string): HTMLButtonElement | undefined =>
    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === name,
    );

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BudgetCategoryViewComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(BudgetCategoryViewComponent);
    component = fixture.componentInstance;
  });

  it('should start the limit at the current budget and show spent and what is left', () => {
    // act
    render(row(1, 450, 512));

    // assert & verify
    expect(component.form.controls.amount.value).toBe(450);
    expect(fixture.nativeElement.textContent).toContain('Spent $512.00');
    expect(fixture.nativeElement.textContent).toContain('$62.00 over');
  });

  it('should start empty for a category with no limit and need one before saving', () => {
    // arrange
    render(row(1, 0, 120, null));
    const saved = vi.fn();
    component.save.subscribe(saved);

    // act
    component.submit();

    // assert & verify
    expect(component.form.controls.amount.value).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('No limit set yet');
    expect(saved).not.toHaveBeenCalled();

    // act
    component.form.controls.amount.setValue(200);
    component.submit();

    // assert & verify
    expect(saved).toHaveBeenCalledWith(200);
  });

  it('should emit the new limit on submit, and nothing while invalid or saving', () => {
    // arrange
    render(row(1, 450, 100));
    const saved = vi.fn();
    component.save.subscribe(saved);

    // act
    component.form.controls.amount.setValue(500);
    component.submit();
    component.form.controls.amount.setValue(-1);
    component.submit();
    fixture.componentRef.setInput('saving', true);
    component.form.controls.amount.setValue(600);
    component.submit();

    // assert & verify
    expect(saved).toHaveBeenCalledTimes(1);
    expect(saved).toHaveBeenCalledWith(500);
  });

  it('should accept a limit of zero and explain a rejected one in words', () => {
    // arrange
    render(row(1, 450, 100));
    const saved = vi.fn();
    component.save.subscribe(saved);

    // act
    component.form.controls.amount.setValue(0);
    component.submit();
    component.form.controls.amount.setValue(null);
    component.submit();
    fixture.detectChanges();

    // assert & verify
    expect(saved).toHaveBeenCalledWith(0);
    expect(
      fixture.nativeElement.querySelector('[data-testid="amount-error"]').textContent,
    ).toContain('Enter a limit of $0 or more.');
  });

  it('should keep what was typed when the same category is refreshed, and reset for another', () => {
    // arrange
    render(row(1, 450, 100));
    component.form.controls.amount.setValue(777);

    // act and assert & verify
    render(row(1, 450, 200));
    expect(component.form.controls.amount.value).toBe(777);
    render(row(2, 100, 0));
    expect(component.form.controls.amount.value).toBe(100);
  });

  it('should emit remove and view transactions, and hide Remove when the budget id is unknown', () => {
    // arrange
    render(row(1, 450, 100));
    const removed = vi.fn();
    const viewed = vi.fn();
    component.remove.subscribe(removed);
    component.viewTransactions.subscribe(viewed);

    // act
    button('Remove budget')?.click();
    button('View transactions')?.click();

    // assert & verify
    expect(removed).toHaveBeenCalledTimes(1);
    expect(viewed).toHaveBeenCalledTimes(1);

    // act
    render(row(1, 450, 100, null));

    // assert & verify
    expect(button('Remove budget')).toBeUndefined();
  });

  it('should fill in the limit once an unbudgeted category gets its budget (same category, new budget id)', () => {
    // arrange -- the add flow opens the category before the reload: still spending with no limit
    render(row(1, 0, 120, null));
    expect(component.form.controls.amount.value).toBeNull();

    // act -- the reload returns the same category, now with its 300 budget
    render(row(1, 300, 120, 9));

    // assert & verify
    expect(component.form.controls.amount.value).toBe(300);
  });

  // PF-880
  describe('init and the first render', () => {
    const setRow = (r: BudgetRow): void => {
      fixture.componentRef.setInput('row', r);
      fixture.componentRef.setInput('monthName', 'October');
      fixture.componentRef.setInput('saving', false);
    };

    it('should fill its limit at init, before any effect or render', () => {
      // arrange
      setRow(row(1, 450, 100));

      // act
      component.ngOnInit();

      // assert & verify
      expect(component.form.controls.amount.value).toBe(450);
    });

    it('should not reset again on the first render (typing survives it)', () => {
      // arrange
      setRow(row(1, 450, 100));
      component.ngOnInit();
      component.form.controls.amount.setValue(999);

      // act -- the first render and its effects run now
      fixture.detectChanges();

      // assert & verify
      expect(component.form.controls.amount.value).toBe(999);
    });
  });
});
