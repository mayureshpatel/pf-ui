import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Transaction, TransactionType } from '@models/transaction.model';
import { TransactionListComponent } from './transaction-list.component';

function txn(partial: Partial<Transaction> & { id: number }): Transaction {
  return {
    date: '2026-10-17T00:00:00Z',
    type: TransactionType.EXPENSE,
    amount: 10,
    description: 'DESC',
    account: { id: 1, name: 'Checking' },
    category: { id: 5, name: 'Groceries', color: 'bg-emerald-500' },
    merchant: { id: 2, name: 'Whole Foods' },
    tags: [],
    ...partial,
  } as unknown as Transaction;
}

describe('TransactionListComponent', () => {
  let fixture: ComponentFixture<TransactionListComponent>;
  let component: TransactionListComponent;

  function render(
    transactions: Transaction[],
    overrides: Partial<{ sort: string; selectedIds: number[]; loading: boolean; page: number; pageCount: number }> = {},
  ): void {
    fixture.componentRef.setInput('transactions', transactions);
    fixture.componentRef.setInput('sort', overrides.sort ?? 'date,desc');
    fixture.componentRef.setInput('page', overrides.page ?? 0);
    fixture.componentRef.setInput('pageCount', overrides.pageCount ?? 1);
    fixture.componentRef.setInput('selectedIds', overrides.selectedIds ?? []);
    fixture.componentRef.setInput('loading', overrides.loading ?? false);
    fixture.detectChanges();
  }

  const all = <T extends HTMLElement>(selector: string): T[] =>
    Array.from(fixture.nativeElement.querySelectorAll(selector));

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TransactionListComponent] }).compileComponents();
    fixture = TestBed.createComponent(TransactionListComponent);
    component = fixture.componentInstance;
  });

  it('should group rows under day headings with a daily net total when sorted by date', () => {
    // act
    render([
      txn({ id: 1, date: '2026-10-17', amount: 20 }),
      txn({ id: 2, date: '2026-10-15', type: TransactionType.INCOME, amount: 3200 }),
    ]);

    // assert & verify
    const headings = all('[data-testid="day-heading"]').map((h) => h.textContent?.replace(/\s+/g, ' ').trim());
    expect(headings.length).toBe(2);
    expect(headings[0]).toContain('-$20.00');
    expect(headings[1]).toContain('+$3,200.00');
  });

  it('should show a flat list with a note, and a Date column, when sorted by anything else', () => {
    // act
    render([txn({ id: 1 }), txn({ id: 2 })], { sort: 'amount,desc' });

    // assert & verify
    expect(all('[data-testid="day-heading"]').length).toBe(0);
    expect(fixture.nativeElement.querySelector('[data-testid="flat-note"]').textContent).toContain(
      'days are not grouped',
    );
    expect(all('th').some((th) => th.textContent?.trim() === 'Date')).toBe(true);
  });

  it('should mark a day heading partial at a page boundary', () => {
    // act
    render([txn({ id: 1, date: '2026-10-17' })], { page: 0, pageCount: 3 });

    // assert & verify
    expect(all('[data-testid="day-heading"]')[0].textContent).toContain('partial');
  });

  it('should show Choose category for an uncategorized row and Transfer for a transfer', () => {
    // act
    render([
      txn({ id: 1, category: null as never }),
      txn({ id: 2, type: TransactionType.TRANSFER }),
    ]);

    // assert & verify
    expect(all('[data-testid="choose-category"]').length).toBe(1);
    expect(all('[data-testid="transfer-pill"]').length).toBe(1);
  });

  it('should emit the transaction when the merchant button is used, and when Choose category is clicked', () => {
    // arrange
    const rows = [txn({ id: 1, category: null as never })];
    render(rows);
    const opened = vi.fn();
    const picked = vi.fn();
    component.openTransaction.subscribe(opened);
    component.pickCategory.subscribe(picked);

    // act
    all<HTMLButtonElement>('[data-testid="open-transaction"]')[0].click();
    all<HTMLButtonElement>('[data-testid="choose-category"]')[0].click();

    // assert & verify -- picking a category must not also open the editor
    expect(opened).toHaveBeenCalledTimes(1);
    expect(opened).toHaveBeenCalledWith(rows[0]);
    expect(picked).toHaveBeenCalledWith(rows[0]);
  });

  it('should emit the full new selection from a row checkbox and from the header checkbox', () => {
    // arrange
    render([txn({ id: 1 }), txn({ id: 2 }), txn({ id: 3 })], { selectedIds: [1] });
    const changed = vi.fn();
    component.selectionChange.subscribe(changed);

    // act
    all<HTMLInputElement>('[data-testid="row-checkbox"]')[1].click();

    // assert & verify
    expect(changed).toHaveBeenLastCalledWith([1, 2]);

    // act
    all<HTMLInputElement>('[data-testid="header-checkbox"]')[0].click();

    // assert & verify -- header selects the whole page
    expect(changed).toHaveBeenLastCalledWith([1, 2, 3]);
  });

  it('should select a range with shift-click', () => {
    // arrange
    render([txn({ id: 1 }), txn({ id: 2 }), txn({ id: 3 }), txn({ id: 4 })]);
    const changed = vi.fn();
    component.selectionChange.subscribe(changed);
    const boxes = all<HTMLInputElement>('[data-testid="row-checkbox"]');

    // act
    boxes[0].click();
    boxes[2].dispatchEvent(new MouseEvent('click', { shiftKey: true, bubbles: true }));

    // assert & verify
    expect(changed).toHaveBeenLastCalledWith([1, 2, 3]);
  });

  it('should toggle sort direction on an active header and start descending on a new one', () => {
    // arrange
    render([txn({ id: 1 })], { sort: 'amount,desc' });
    const sorted = vi.fn();
    component.sortChange.subscribe(sorted);
    const header = (label: string): HTMLButtonElement =>
      all<HTMLButtonElement>('th button').find((b) => b.textContent?.trim() === label)!;

    // act
    header('Amount').click();
    // assert & verify
    expect(sorted).toHaveBeenLastCalledWith('amount,asc');

    // act
    header('Category').click();
    // assert & verify
    expect(sorted).toHaveBeenLastCalledWith('category.name,desc');
  });

  it('should render skeleton rows while loading with no rows yet', () => {
    // act
    render([], { loading: true });

    // assert & verify
    expect(all('[data-testid="skeleton-row"]').length).toBeGreaterThan(0);
  });

  it('should be keyboard operable: every row has a native button to open it', () => {
    // act
    render([txn({ id: 1 }), txn({ id: 2 })]);

    // assert & verify
    expect(all('[data-testid="open-transaction"]').length).toBe(2);
  });
});
