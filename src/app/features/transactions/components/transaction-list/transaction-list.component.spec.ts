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
    overrides: Partial<{
      sort: string;
      selectedIds: number[];
      loading: boolean;
      page: number;
      pageCount: number;
      compact: boolean;
    }> = {},
  ): void {
    fixture.componentRef.setInput('transactions', transactions);
    fixture.componentRef.setInput('sort', overrides.sort ?? 'date,desc');
    fixture.componentRef.setInput('page', overrides.page ?? 0);
    fixture.componentRef.setInput('pageCount', overrides.pageCount ?? 1);
    fixture.componentRef.setInput('selectedIds', overrides.selectedIds ?? []);
    fixture.componentRef.setInput('loading', overrides.loading ?? false);
    fixture.componentRef.setInput('compact', overrides.compact ?? false);
    fixture.detectChanges();
  }

  const all = <T extends HTMLElement>(selector: string): T[] =>
    Array.from(fixture.nativeElement.querySelectorAll(selector));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransactionListComponent],
    }).compileComponents();
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
    const headings = all('[data-testid="day-heading"]').map((h) =>
      h.textContent?.replace(/\s+/g, ' ').trim(),
    );
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

  // PF-868
  describe('selection accessibility', () => {
    it('should show the header checkbox as indeterminate when only part of the page is selected', () => {
      // act
      render([txn({ id: 1 }), txn({ id: 2 }), txn({ id: 3 })], { selectedIds: [1] });

      // assert & verify
      const header = all<HTMLInputElement>('[data-testid="header-checkbox"]')[0];
      expect(header.indeterminate).toBe(true);
      expect(header.checked).toBe(false);
    });

    it('should show the header checkbox as plain checked when everything is selected, and plain unchecked when nothing is', () => {
      // act
      render([txn({ id: 1 }), txn({ id: 2 })], { selectedIds: [1, 2] });
      const header = all<HTMLInputElement>('[data-testid="header-checkbox"]')[0];

      // assert & verify
      expect(header.indeterminate).toBe(false);
      expect(header.checked).toBe(true);

      // act
      render([txn({ id: 1 }), txn({ id: 2 })], { selectedIds: [] });

      // assert & verify
      expect(header.indeterminate).toBe(false);
      expect(header.checked).toBe(false);
    });

    it('should label each row checkbox with the merchant, amount and date so rows can be told apart', () => {
      // act
      render([
        txn({
          id: 1,
          amount: 4.5,
          date: '2026-10-03T00:00:00Z',
          merchant: { id: 2, name: 'Starbucks' } as never,
        }),
        txn({
          id: 2,
          amount: 6.25,
          date: '2026-10-05T00:00:00Z',
          merchant: { id: 2, name: 'Starbucks' } as never,
        }),
      ]);

      // assert & verify
      const labels = all<HTMLInputElement>('[data-testid="row-checkbox"]').map((b) =>
        b.getAttribute('aria-label'),
      );
      expect(labels).toEqual([
        'Select Starbucks, $4.50, 2026-10-03',
        'Select Starbucks, $6.25, 2026-10-05',
      ]);
      expect(new Set(labels).size).toBe(2);
    });

    it('should forget the shift-click anchor when the page of rows changes', () => {
      // arrange -- click row 1 on the first page
      render([txn({ id: 1 }), txn({ id: 2 }), txn({ id: 3 }), txn({ id: 4 })]);
      const changed = vi.fn();
      component.selectionChange.subscribe(changed);
      all<HTMLInputElement>('[data-testid="row-checkbox"]')[0].click();

      // act -- a different page arrives, then the first click on it is a shift-click
      render([txn({ id: 11 }), txn({ id: 12 }), txn({ id: 13 }), txn({ id: 14 })]);
      all<HTMLInputElement>('[data-testid="row-checkbox"]')[2].dispatchEvent(
        new MouseEvent('click', { shiftKey: true, bubbles: true }),
      );

      // assert & verify -- only the clicked row, not a range from a row never clicked here
      expect(changed).toHaveBeenLastCalledWith([13]);
    });
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

  it('should hide the Description and Tags columns in compact mode, keeping the amount', () => {
    // act
    render([txn({ id: 1, tags: [{ id: 1, name: 'weekly' } as never] })], { compact: true });

    // assert & verify
    const headers = all('th').map((th) => th.textContent?.trim());
    expect(headers).not.toContain('Description');
    expect(headers).not.toContain('Tags');
    expect(headers).toContain('Amount');
    expect(fixture.nativeElement.textContent).not.toContain('weekly');
  });

  it('should show every column when not compact', () => {
    // act
    render([txn({ id: 1 })]);

    // assert & verify
    const headers = all('th').map((th) => th.textContent?.trim());
    expect(headers).toContain('Description');
    expect(headers).toContain('Tags');
  });

  it('should give a selected row a background that also works in dark mode', () => {
    // act
    render([txn({ id: 1 }), txn({ id: 2 })], { selectedIds: [1] });

    // assert & verify
    const rows = all('tbody tr');
    expect(rows[1].className).toContain('bg-primary-50');
    expect(rows[1].className).toContain('dark:bg-primary-900/30');
    expect(rows[2].className).not.toContain('bg-primary-50');
  });

  it('should keep Merchant, Category and Amount on a phone and hide Description, Account and Tags', () => {
    // act
    render([txn({ id: 1 })]);

    // assert & verify
    const header = (label: string): HTMLElement =>
      all('th').find((th) => th.textContent?.trim() === label)!;
    for (const hidden of ['Description', 'Account', 'Tags']) {
      expect(header(hidden).className).toContain('hidden');
      expect(header(hidden).className).toContain('sm:table-cell');
    }
    for (const shown of ['Merchant', 'Category', 'Amount']) {
      expect(header(shown).className).not.toContain('hidden');
    }
    // the matching body cells hide too, so the columns stay aligned
    const row = all('tbody tr').find((tr) => tr.textContent?.includes('Whole Foods'))!;
    const cells = Array.from(row.querySelectorAll('td'));
    expect(cells.filter((c) => c.className.includes('hidden')).length).toBe(3);
  });

  it('should dim the old rows and mark the table busy while new results load', () => {
    // act
    render([txn({ id: 1 })], { loading: true });

    // assert & verify
    const wrapper = fixture.nativeElement.firstElementChild as HTMLElement;
    expect(wrapper.getAttribute('aria-busy')).toBe('true');
    expect(wrapper.className).toContain('opacity-60');
    expect(wrapper.className).toContain('pointer-events-none');
  });

  it('should look normal once loading finishes', () => {
    // act
    render([txn({ id: 1 })]);

    // assert & verify
    const wrapper = fixture.nativeElement.firstElementChild as HTMLElement;
    expect(wrapper.getAttribute('aria-busy')).not.toBe('true');
    expect(wrapper.className).not.toContain('opacity-60');
  });
});
