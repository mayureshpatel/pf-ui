import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RecurringFrequency, RecurringTransaction } from '@models/recurring.model';
import { groupByFrequency, RecurringGroup } from '../../utils/recurring-helpers';
import { RecurringListComponent } from './recurring-list.component';

const YEAR = new Date().getFullYear();
const day = (month: number, date: number): string =>
  `${YEAR}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;

const item = (
  id: number,
  name: string,
  amount: number,
  frequency: RecurringFrequency,
  nextDate: string,
  over: Partial<RecurringTransaction> = {},
): RecurringTransaction =>
  ({
    id,
    userId: 1,
    account: { id: 1, name: 'Checking' },
    merchant: { id, name },
    amount,
    frequency,
    nextDate,
    active: true,
    ...over,
  }) as RecurringTransaction;

describe('RecurringListComponent', () => {
  let fixture: ComponentFixture<RecurringListComponent>;
  let component: RecurringListComponent;

  function render(
    items: RecurringTransaction[],
    over: Partial<{ selectedId: number | null; loading: boolean }> = {},
  ): void {
    const groups: RecurringGroup[] = groupByFrequency(items);
    fixture.componentRef.setInput('groups', groups);
    fixture.componentRef.setInput('selectedId', over.selectedId ?? null);
    fixture.componentRef.setInput('loading', over.loading ?? false);
    fixture.detectChanges();
  }
  const all = <T extends HTMLElement>(s: string): T[] =>
    Array.from(fixture.nativeElement.querySelectorAll(s));
  const text = (e: Element | null | undefined): string =>
    (e?.textContent ?? '').replace(/\s+/g, ' ').trim();

  const monthlyItems = [
    item(1, 'Netflix', 22.99, 'MONTHLY', day(11, 3)),
    item(2, 'Rent', 1500, 'MONTHLY', day(11, 1)),
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RecurringListComponent] }).compileComponents();
    fixture = TestBed.createComponent(RecurringListComponent);
    component = fixture.componentInstance;
  });

  it('should show a total per frequency group and a count for Paused', () => {
    // act
    render([
      ...monthlyItems,
      item(3, 'Gym', 40, 'MONTHLY', day(11, 5), { active: false }),
      item(4, 'Hulu', 17, 'MONTHLY', day(11, 6), { active: false }),
    ]);

    // assert & verify
    const headers = all('[data-testid="group-header"]').map(text);
    expect(headers[0]).toContain('Monthly');
    expect(headers[0]).toContain('$1,522.99 / mo');
    expect(headers[1]).toContain('Paused');
    expect(headers[1]).toContain('2 paused');
  });

  it('should keep the paused count dark enough to read on the group header (contrast)', () => {
    // act
    render([item(1, 'Gym', 40, 'MONTHLY', day(11, 5), { active: false })]);

    // assert & verify
    const count = all('[data-testid="group-header"] span')[0];
    expect(count.className).toContain('text-surface-600');
    expect(count.className).not.toContain('text-muted-color');
  });

  it('should show the merchant, amount, next date and account on each row, soonest first', () => {
    // act
    render(monthlyItems);

    // assert & verify
    const rows = all('[data-testid="open-item"]').map(text);
    expect(rows[0]).toContain('Rent');
    expect(rows[0]).toContain('$1,500.00');
    expect(rows[0]).toContain('Next Nov 1');
    expect(rows[0]).toContain('Checking');
    expect(rows[1]).toContain('Netflix');
  });

  it('should show the price change line in amber text', () => {
    // act
    render([
      item(1, 'Netflix', 10, 'MONTHLY', day(11, 3), {
        priceChange: { previousAmount: 10, newAmount: 12, since: day(9, 3) },
      }),
    ]);

    // assert & verify
    const line = all('[data-testid="price-change"]')[0];
    expect(text(line)).toBe('Was $10.00, now $12.00 since Sep 3');
    expect(line.className).toContain('text-amber-700');
  });

  it('should not show a price change line on a paused row', () => {
    // act
    render([
      item(1, 'Gym', 12, 'MONTHLY', day(11, 5), {
        active: false,
        priceChange: { previousAmount: 10, newAmount: 12, since: day(9, 3) },
      }),
    ]);

    // assert & verify (PF-885)
    expect(all('[data-testid="price-change"]')).toHaveLength(0);
  });

  it('should mark the selected row with aria-current besides its colour', () => {
    // act
    render(monthlyItems, { selectedId: 2 });

    // assert & verify (PF-885)
    const buttons = all('[data-testid="open-item"]');
    expect(buttons[0].getAttribute('aria-current')).toBe('true');
    expect(buttons[1].getAttribute('aria-current')).toBeNull();
  });

  it('should show Expected instead of a next date when the charge is overdue', () => {
    // act
    render([
      item(1, 'Netflix', 10, 'MONTHLY', day(10, 1), {
        overdue: true,
        projectedNextDate: day(10, 28),
      }),
    ]);

    // assert & verify
    const row = text(all('[data-testid="open-item"]')[0]);
    expect(row).toContain('Expected Oct 28');
    expect(row).not.toContain('Next');
  });

  it('should show Paused text on a paused row', () => {
    // act
    render([item(1, 'Gym', 40, 'MONTHLY', day(11, 5), { active: false })]);

    // assert & verify
    expect(text(all('[data-testid="open-item"]')[0])).toContain('Paused');
  });

  it('should highlight the selected item with a dark variant', () => {
    // act
    render(monthlyItems, { selectedId: 2 });

    // assert & verify
    const rows = all('[data-testid="item-row"]');
    expect(rows[0].className).toContain('bg-primary-50');
    expect(rows[0].className).toContain('dark:bg-primary-900/30');
    expect(rows[1].className).not.toContain('bg-primary-50');
  });

  it('should dim and mark busy while loading', () => {
    // act
    render(monthlyItems, { loading: true });

    // assert & verify
    const wrapper = all('[data-testid="recurring-list"]')[0];
    expect(wrapper.getAttribute('aria-busy')).toBe('true');
    expect(wrapper.className).toContain('opacity-60');
  });

  it('should emit openItem when a row is clicked', () => {
    // arrange
    const opened: RecurringTransaction[] = [];
    component.openItem.subscribe((i: RecurringTransaction) => opened.push(i));
    render(monthlyItems);

    // act
    all<HTMLButtonElement>('[data-testid="open-item"]')[1].click();

    // assert & verify
    expect(opened.map((i) => i.id)).toEqual([1]);
  });

  it('should show two items that share a merchant name', () => {
    // act
    render([
      item(1, 'Shell', 5, 'MONTHLY', day(11, 3)),
      item(2, 'Shell', 6, 'MONTHLY', day(11, 4)),
    ]);

    // assert & verify
    expect(all('[data-testid="open-item"]')).toHaveLength(2);
  });
});
