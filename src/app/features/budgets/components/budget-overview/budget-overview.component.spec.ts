import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BudgetOverviewComponent } from './budget-overview.component';
import { BudgetTotals } from '../../utils/budget-helpers';

describe('BudgetOverviewComponent', () => {
  let fixture: ComponentFixture<BudgetOverviewComponent>;
  let component: BudgetOverviewComponent;

  /** Renders totals for one category group: `over` of the budgeted amount is over its limit. */
  function render(
    budgeted: number,
    spent: number,
    canCopy = true,
    unbudgeted = 0,
    extra: Partial<BudgetTotals> = {},
  ): void {
    const over = Math.max(spent - budgeted, 0);
    fixture.componentRef.setInput('totals', {
      budgeted,
      spent,
      left: budgeted - spent,
      unbudgeted,
      limitCount: budgeted > 0 || spent > 0 ? 1 : 0,
      overCount: over > 0 ? 1 : 0,
      overAmount: over,
      remaining: Math.max(budgeted - spent, 0),
      ...extra,
    });
    fixture.componentRef.setInput('monthLabel', 'October 2026');
    fixture.componentRef.setInput('canCopy', canCopy);
    fixture.detectChanges();
  }
  const q = <T extends HTMLElement>(s: string): T => fixture.nativeElement.querySelector(s) as T;
  const button = (name: string): HTMLButtonElement | undefined =>
    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === name,
    );

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BudgetOverviewComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(BudgetOverviewComponent);
    component = fixture.componentInstance;
  });

  it('should show what is left to spend and spent of budgeted', () => {
    // act
    render(2252, 1640);

    // assert & verify
    expect(q('[data-testid="left-to-spend"]').textContent).toContain('$612.00');
    expect(fixture.nativeElement.textContent).toContain('Spent $1,640.00 of $2,252.00');
  });

  it('should lead with how much is over, in rose, when a category is over its limit', () => {
    // act
    render(100, 130);

    // assert & verify
    const over = q('[data-testid="over-amount"]');
    expect(over.textContent?.trim()).toBe('$30.00 over');
    expect(over.className).toContain('text-rose-700');
    expect(q('[data-testid="over-count"]').textContent).toContain('in 1 category');
    expect(q('[data-testid="left-to-spend"]')).toBeNull();
  });

  it('should not net an overspend against what is left elsewhere', () => {
    // act: one category 62.33 over, 1,000 left in the rest
    render(1100, 162.33, true, 0, { overCount: 1, overAmount: 62.33, remaining: 1000 });

    // assert & verify
    expect(q('[data-testid="over-amount"]').textContent).toContain('$62.33 over');
    expect(q('[data-testid="remaining"]').textContent).toContain('$1,000.00 left in the other');
  });

  it('should pluralise the over count', () => {
    // act
    render(100, 130, true, 0, { overCount: 2 });

    // assert & verify
    expect(q('[data-testid="over-count"]').textContent).toContain('in 2 categories');
  });

  it('should show no figure and no bar when nothing has a limit', () => {
    // act
    render(0, 0, true, 40);

    // assert & verify
    expect(q('[data-testid="no-limits"]')).not.toBeNull();
    expect(q('[data-testid="left-to-spend"]')).toBeNull();
    expect(q('[role="img"]')).toBeNull();
    expect(q('[data-testid="unbudgeted"]').textContent).toContain('$40.00');
  });

  it('should show a placeholder instead of figures while a month loads', () => {
    // arrange
    render(100, 40);

    // act
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    // assert & verify
    expect(q('[data-testid="left-to-spend"]')).toBeNull();
    expect(q('p-skeleton')).not.toBeNull();
    expect(q('div[aria-busy="true"]')).not.toBeNull();
  });

  it('should size the bar by spent over budgeted, capped at 100, and be empty with nothing budgeted', () => {
    // act and assert & verify
    render(200, 50);
    expect(component.spentWidth()).toBe(25);
    render(100, 130);
    expect(component.spentWidth()).toBe(100);
    render(0, 0);
    expect(component.spentWidth()).toBe(0);
  });

  it('should report spending without a limit on its own line, and omit the line when there is none', () => {
    // act
    render(100, 40, true, 30);

    // assert & verify
    expect(q('[data-testid="unbudgeted"]').textContent).toContain('$30.00');
    expect(q('[data-testid="unbudgeted"]').textContent).toContain('no limit');

    // act
    render(100, 40, true, 0);

    // assert & verify
    expect(q('[data-testid="unbudgeted"]')).toBeNull();
  });

  it('should describe the bar in words', () => {
    // act
    render(2252, 1640);

    // assert & verify
    expect(q('[role="img"]').getAttribute('aria-label')).toBe(
      'Spent $1,640.00 of $2,252.00 budgeted',
    );
  });

  it('should offer Copy only when last month has budgets, and emit from it', () => {
    // arrange
    render(10, 1, false);
    // assert & verify
    expect(button("Copy last month's limits")).toBeUndefined();

    // arrange
    render(10, 1, true);
    const copy = vi.fn();
    component.copyLimits.subscribe(copy);

    // act
    button("Copy last month's limits")?.click();

    // assert & verify
    expect(copy).toHaveBeenCalledTimes(1);
    expect(button('Add budget')).toBeUndefined();
  });
});
