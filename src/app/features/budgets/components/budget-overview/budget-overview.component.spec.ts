import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BudgetOverviewComponent } from './budget-overview.component';

describe('BudgetOverviewComponent', () => {
  let fixture: ComponentFixture<BudgetOverviewComponent>;
  let component: BudgetOverviewComponent;

  function render(budgeted: number, spent: number, canCopy = true, unbudgeted = 0): void {
    fixture.componentRef.setInput('totals', {
      budgeted,
      spent,
      left: budgeted - spent,
      unbudgeted,
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

  it('should show a minus sign and rose text when over budget overall', () => {
    // act
    render(100, 130);

    // assert & verify
    const left = q('[data-testid="left-to-spend"]');
    expect(left.textContent?.trim()).toContain('-$30.00');
    expect(left.className).toContain('text-rose-700');
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

  it('should offer Copy only when last month has budgets, and emit from both actions', () => {
    // arrange
    render(10, 1, false);
    // assert & verify
    expect(button("Copy last month's limits")).toBeUndefined();

    // arrange
    render(10, 1, true);
    const copy = vi.fn();
    const add = vi.fn();
    component.copyLimits.subscribe(copy);
    component.add.subscribe(add);

    // act
    button("Copy last month's limits")?.click();
    button('Add budget')?.click();

    // assert & verify
    expect(copy).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledTimes(1);
  });
});
