import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BudgetStatus } from '@models/budget.model';
import { Category } from '@models/category.model';
import { budgetRows, groupBudgetRows } from '../../utils/budget-helpers';
import { BudgetListComponent } from './budget-list.component';

const status = (id: number, name: string, budgeted: number, spent: number): BudgetStatus => ({
  category: { id, name, parent: null, icon: 'pi-tag', color: '#10b981' } as unknown as Category,
  budgetedAmount: budgeted,
  spentAmount: spent,
  remainingAmount: budgeted - spent,
  percentageUsed: budgeted ? (spent / budgeted) * 100 : 0,
});

describe('BudgetListComponent', () => {
  let fixture: ComponentFixture<BudgetListComponent>;
  let component: BudgetListComponent;
  const statuses = [
    status(1, 'Groceries', 450, 512),
    status(2, 'Dining out', 200, 184),
    status(3, 'Transport', 250, 96),
  ];

  function render(
    over: { selected?: number | null; loading?: boolean; list?: BudgetStatus[] } = {},
  ): void {
    fixture.componentRef.setInput('groups', groupBudgetRows(budgetRows(over.list ?? statuses, [])));
    fixture.componentRef.setInput('selectedCategoryId', over.selected ?? null);
    fixture.componentRef.setInput('loading', over.loading ?? false);
    fixture.detectChanges();
  }
  const all = <T extends HTMLElement>(s: string): T[] =>
    Array.from(fixture.nativeElement.querySelectorAll(s));

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [BudgetListComponent] }).compileComponents();
    fixture = TestBed.createComponent(BudgetListComponent);
    component = fixture.componentInstance;
  });

  it('should show the three group headings with what is left in each, over as words', () => {
    // act
    render();

    // assert & verify
    const headings = all('[data-testid="group-heading"]').map((h) =>
      h.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(headings[0]).toContain('Over the limit');
    expect(headings[0]).toContain('$62.00 over');
    expect(headings[1]).toContain('Close to the limit');
    expect(headings[1]).toContain('$16.00 left');
    expect(headings[2]).toContain('On track');
    expect(headings[2]).toContain('$154.00 left');
  });

  it('should show each category with its spent of limit and what is left or over', () => {
    // act
    render();

    // assert & verify
    const rows = all('[data-testid="open-budget"]');
    expect(rows[0].textContent).toContain('Groceries');
    expect(rows[0].textContent).toContain('$512.00 of $450.00');
    expect(rows[0].textContent).toContain('$62.00 over');
    expect(rows[1].textContent).toContain('$16.00 left');
    // the visible text is the accessible name: no aria-label override that could drift from it
    expect(rows[0].getAttribute('aria-label')).toBeNull();
  });

  it('should colour the bar by group and cap its width at 100%', () => {
    // act
    render();

    // assert & verify
    const bars = all('[data-testid="budget-bar"]');
    expect(bars[0].className).toContain('bg-rose-500');
    expect(bars[0].style.width).toBe('100%');
    expect(bars[1].className).toContain('bg-amber-500');
    expect(bars[2].className).toContain('bg-emerald-500');
    expect(bars[2].style.width).toBe('38.4%');
  });

  it('should emit the row when a category is opened', () => {
    // arrange
    render();
    const opened = vi.fn();
    component.openCategory.subscribe(opened);

    // act
    all<HTMLButtonElement>('[data-testid="open-budget"]')[1].click();

    // assert & verify
    expect(opened).toHaveBeenCalledTimes(1);
    expect(opened.mock.calls[0][0].status.category.name).toBe('Dining out');
  });

  it('should highlight the selected category with a dark-mode variant', () => {
    // act
    render({ selected: 3 });

    // assert & verify
    const rows = all('li');
    expect(rows[0].className).not.toContain('bg-primary-50');
    expect(rows[2].className).toContain('bg-primary-50');
    expect(rows[2].className).toContain('dark:bg-primary-900/30');
  });

  it('should dim the list and mark it busy while reloading', () => {
    // act
    render({ loading: true });

    // assert & verify
    const wrapper = fixture.nativeElement.firstElementChild as HTMLElement;
    expect(wrapper.getAttribute('aria-busy')).toBe('true');
    expect(wrapper.className).toContain('opacity-60');
  });

  it('should show spending with no limit under No limit set, without a bar or an over label', () => {
    // arrange
    fixture.componentRef.setInput(
      'groups',
      groupBudgetRows(budgetRows([status(1, 'Gifts', 0, 120), status(2, 'Fuel', 0, 80)], [])),
    );
    fixture.componentRef.setInput('selectedCategoryId', null);
    fixture.componentRef.setInput('loading', false);

    // act
    fixture.detectChanges();

    // assert & verify
    const heading = all('[data-testid="group-heading"]')[0].textContent?.replace(/\s+/g, ' ');
    expect(heading).toContain('No limit set');
    expect(heading).toContain('$200.00 spent');
    expect(heading).not.toContain('over');
    const first = all('[data-testid="open-budget"]')[0];
    expect(first.getAttribute('aria-label')).toBeNull();
    expect(first.textContent).toContain('Gifts');
    expect(first.textContent).toContain('$120.00 spent');
    expect(first.textContent).toContain('No limit');
    expect(all('[data-testid="budget-bar"]').length).toBe(0);
  });

  it('should show a $0 budget with spending as over and one with none as on track', () => {
    // arrange -- real $0 budgets have ids, unlike spending with no budget at all
    const rows = budgetRows(
      [status(1, 'Zero spent', 0, 0), status(2, 'Zero over', 0, 5)],
      [
        { id: 1, userId: 1, category: statuses[0].category, amount: 0, month: 10, year: 2026 },
        {
          id: 2,
          userId: 1,
          category: { ...statuses[0].category, id: 2 },
          amount: 0,
          month: 10,
          year: 2026,
        },
      ],
    );
    fixture.componentRef.setInput('groups', groupBudgetRows(rows));
    fixture.componentRef.setInput('selectedCategoryId', null);
    fixture.componentRef.setInput('loading', false);

    // act
    fixture.detectChanges();

    // assert & verify
    const texts = all('[data-testid="open-budget"]').map((r) =>
      r.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(texts).toContain('Zero over $5.00 of $0.00 $5.00 over');
    expect(texts).toContain('Zero spent $0.00 of $0.00 $0.00 left');
  });
});
