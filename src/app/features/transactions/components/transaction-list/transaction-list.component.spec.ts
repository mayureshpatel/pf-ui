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

  // the table and the cards are both in the DOM; each is checked on its own
  const ruleButtons = (scope = 'table'): HTMLButtonElement[] =>
    all<HTMLButtonElement>(`${scope} button`).filter((b) =>
      (b.getAttribute('aria-label') ?? '').startsWith('Create rule from'),
    );

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

  describe('Create rule action', () => {
    it('should offer Create rule on each row, named after its raw description', () => {
      // act
      render([
        txn({ id: 1, description: 'NETFLIX.COM 866-579' }),
        txn({ id: 2, description: 'SHELL OIL 123' }),
      ]);

      // assert & verify
      expect(ruleButtons().map((b) => b.getAttribute('aria-label'))).toEqual([
        'Create rule from NETFLIX.COM 866-579',
        'Create rule from SHELL OIL 123',
      ]);
    });

    it('should keep the action in the compact list beside the panel', () => {
      // act
      render([txn({ id: 1, description: 'NETFLIX.COM' })], { compact: true });

      // assert & verify
      expect(ruleButtons().length).toBe(1);
    });

    it('should emit the row without opening it or changing the selection', () => {
      // arrange
      const rows = [txn({ id: 1, description: 'NETFLIX.COM' })];
      render(rows);
      const created = vi.fn();
      const opened = vi.fn();
      const selected = vi.fn();
      component.createRule.subscribe(created);
      component.openTransaction.subscribe(opened);
      component.selectionChange.subscribe(selected);

      // act
      ruleButtons()[0].click();

      // assert & verify
      expect(created).toHaveBeenCalledWith(rows[0]);
      expect(opened).not.toHaveBeenCalled();
      expect(selected).not.toHaveBeenCalled();
    });

    it('should be a comfortable tap target that never overlaps the merchant button', async () => {
      // arrange
      render([]); // inputs are set before the first await lets the page render
      const { page } = await import('vitest/browser');
      const before = { width: window.innerWidth, height: window.innerHeight };
      document.body.appendChild(fixture.nativeElement);
      const check = (scope: string, merchantId: string): void => {
        const action = ruleButtons(scope)[0].getBoundingClientRect();
        const merchant = all<HTMLButtonElement>(
          `[data-testid="${merchantId}"]`,
        )[0].getBoundingClientRect();
        expect(action.width).toBeGreaterThanOrEqual(32);
        expect(action.height).toBeGreaterThanOrEqual(32);
        const overlaps =
          action.left < merchant.right &&
          merchant.left < action.right &&
          action.top < merchant.bottom &&
          merchant.top < action.bottom;
        expect(overlaps).toBe(false);
      };

      try {
        // act -- desktop
        await page.viewport(1024, 768);
        render([txn({ id: 1, description: 'NETFLIX.COM 866-579' })]);

        // assert & verify
        check('table', 'open-transaction');

        // act -- the narrowest table, compacted beside the panel
        await page.viewport(640, 812);
        render([txn({ id: 1, description: 'NETFLIX.COM 866-579' })], { compact: true });

        // assert & verify
        check('table', 'open-transaction');

        // act -- a phone shows cards
        await page.viewport(375, 812);
        render([txn({ id: 1, description: 'NETFLIX.COM 866-579' })]);

        // assert & verify
        check('[data-testid="card-list"]', 'card-open-transaction');
      } finally {
        await page.viewport(before.width, before.height);
        fixture.nativeElement.remove();
      }
    });

    it('should not widen the phone cards past the screen, so Amount stays in view', async () => {
      // arrange -- the list's width on a 375px phone (page gutters taken off)
      render([]); // inputs are set before the first await lets the page render
      const { page } = await import('vitest/browser');
      const before = { width: window.innerWidth, height: window.innerHeight };
      const frame = document.createElement('div');
      frame.style.width = '343px';
      frame.appendChild(fixture.nativeElement);
      document.body.appendChild(frame);
      const rows = [
        txn({
          id: 1,
          description: 'Balance Reconciliation',
          merchant: null as never,
          category: null as never,
          amount: 2000,
        }),
        txn({
          id: 2,
          description: 'TST*BROOKLYN BAGEL & COFFEE CO',
          merchant: { id: 8, name: 'Averyveryverylongmerchantnamewithoutanyspaces' } as never,
        }),
        txn({
          id: 3,
          merchant: { id: 7, name: 'Wholefoodsmarketplace' } as never,
          amount: 1234.56,
          tags: [
            { id: 1, name: 'weekly' },
            { id: 2, name: 'groceries' },
          ] as never,
        }),
      ];
      const check = (): void => {
        const wrapper = fixture.nativeElement.firstElementChild as HTMLElement;
        expect(ruleButtons('[data-testid="card-list"]').length).toBe(3);
        expect(wrapper.scrollWidth).toBeLessThanOrEqual(wrapper.clientWidth);
        const right = wrapper.getBoundingClientRect().right;
        all('[data-testid="card-amount"]').forEach((amount) =>
          expect(amount.getBoundingClientRect().right).toBeLessThanOrEqual(right + 0.5),
        );
        ruleButtons('[data-testid="card-list"]').forEach((b) => {
          expect(b.getBoundingClientRect().width).toBeGreaterThanOrEqual(32);
          expect(b.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
        });
      };

      try {
        // act
        render(rows);
        await page.viewport(375, 812);
        fixture.detectChanges();

        // assert & verify
        check();

        // act -- a phone with the panel open renders the same cards
        render(rows, { compact: true });

        // assert & verify
        check();
      } finally {
        await page.viewport(before.width, before.height);
        frame.remove();
      }
    });

    it('should not add a column width to the compact list beside the panel', () => {
      // arrange
      document.body.appendChild(fixture.nativeElement);
      render([txn({ id: 1, description: 'NETFLIX.COM 866-579' })], { compact: true });
      const merchantCell = all<HTMLButtonElement>('[data-testid="open-transaction"]')[0]
        .parentElement!.parentElement as HTMLTableCellElement;

      // act
      const name = all<HTMLButtonElement>('[data-testid="open-transaction"]')[0];
      const action = ruleButtons()[0];

      // assert & verify -- the action sits under the name, not beside it
      expect(action.getBoundingClientRect().top).toBeGreaterThanOrEqual(
        name.getBoundingClientRect().bottom - 0.5,
      );
      expect(merchantCell.contains(action)).toBe(true);
      fixture.nativeElement.remove();
    });

    it('should be a real button reachable by keyboard, opening on Enter', async () => {
      // arrange
      const rows = [txn({ id: 1, description: 'NETFLIX.COM' })];
      render(rows);
      document.body.appendChild(fixture.nativeElement);
      const created = vi.fn();
      const opened = vi.fn();
      component.createRule.subscribe(created);
      component.openTransaction.subscribe(opened);
      const { page, userEvent } = await import('vitest/browser');
      const before = { width: window.innerWidth, height: window.innerHeight };
      await page.viewport(1024, 768); // the table is hidden on a phone, where the cards show
      all<HTMLButtonElement>('[data-testid="open-transaction"]')[0].focus();

      // act
      await userEvent.tab();
      await userEvent.keyboard('{Enter}');

      // assert & verify
      expect(document.activeElement).toBe(ruleButtons()[0]);
      expect(created).toHaveBeenCalledWith(rows[0]);
      expect(opened).not.toHaveBeenCalled();
      await page.viewport(before.width, before.height);
      fixture.nativeElement.remove();
    });
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

  it('should sort Merchant A to Z first, then toggle, and mark it in the header', () => {
    // arrange
    render([txn({ id: 1 })], { sort: 'amount,desc' });
    const sorted = vi.fn();
    component.sortChange.subscribe(sorted);
    const header = (): HTMLButtonElement =>
      all<HTMLButtonElement>('th button').find((b) => b.textContent?.trim() === 'Merchant')!;

    // act
    header().click();
    // assert & verify
    expect(sorted).toHaveBeenLastCalledWith('merchant.name,asc');

    // act
    fixture.componentRef.setInput('sort', 'merchant.name,asc');
    fixture.detectChanges();
    header().click();
    // assert & verify
    expect(sorted).toHaveBeenLastCalledWith('merchant.name,desc');
    expect(header().closest('th')?.getAttribute('aria-sort')).toBe('ascending');
  });

  it('should put the Description column before the Merchant column', () => {
    // act
    render([txn({ id: 1 })]);

    // assert & verify
    const headers = all('th').map((th) => th.textContent?.trim());
    expect(headers.indexOf('Description')).toBeGreaterThan(-1);
    expect(headers.indexOf('Description')).toBeLessThan(headers.indexOf('Merchant'));
  });

  it('should leave the Merchant cell blank and show the description when a row has no merchant', () => {
    // act
    render([txn({ id: 1, merchant: null as never, description: 'ACME HARDWARE 0042' })]);

    // assert & verify -- cells are: checkbox, description, merchant, ...
    const cells = all('tbody tr:not(:has(th)) td');
    expect(cells[1].textContent?.trim()).toBe('ACME HARDWARE 0042');
    expect(cells[2].textContent?.trim()).toBe('');
  });

  it('should show the description in the Description column for a row that has a merchant too', () => {
    // act
    render([txn({ id: 1, description: 'WHOLEFDS #123' })]);

    // assert & verify
    const cells = all('tbody tr:not(:has(th)) td');
    expect(cells[1].textContent?.trim()).toBe('WHOLEFDS #123');
    expect(cells[2].textContent).toContain('Whole Foods');
  });

  it('should still open a merchant-less row from its description by button', () => {
    // arrange
    render([txn({ id: 1, merchant: null as never, description: 'ACME HARDWARE 0042' })]);
    const opened = vi.fn();
    component.openTransaction.subscribe(opened);

    // act
    all<HTMLButtonElement>('[data-testid="open-transaction"]')[0].click();

    // assert & verify
    expect(opened).toHaveBeenCalledTimes(1);
  });

  it('should fall back to the description in compact mode, where the Description column is hidden', () => {
    // act
    render([txn({ id: 1, merchant: null as never, description: 'ACME HARDWARE 0042' })], {
      compact: true,
    });

    // assert & verify
    expect(all('[data-testid="open-transaction"]')[0].textContent?.trim()).toBe(
      'ACME HARDWARE 0042',
    );
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
    expect(fixture.nativeElement.querySelector('table').textContent).not.toContain('weekly');
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

  describe('stacked cards below sm', () => {
    const cards = (): HTMLElement[] => all('[data-testid="card"]');
    const text = (el: Element): string => el.textContent?.replace(/\s+/g, ' ').trim() ?? '';

    it('should render one card per transaction with merchant, amount, date, category and account', () => {
      // act
      render([
        txn({
          id: 1,
          amount: 42.5,
          date: '2026-10-17T00:00:00Z',
          description: 'WHOLEFDS #123',
          account: { id: 1, name: 'Checking' } as never,
        }),
      ]);

      // assert & verify
      expect(cards().length).toBe(1);
      const card = text(cards()[0]);
      expect(card).toContain('Whole Foods');
      expect(card).toContain('-$42.50');
      expect(card).toContain('2026-10-17');
      expect(card).toContain('Groceries');
      expect(card).toContain('Checking');
    });

    it('should fall back to the description when there is no merchant', () => {
      // act
      render([txn({ id: 1, merchant: null as never, description: 'Balance Reconciliation' })]);

      // assert & verify
      expect(text(all('[data-testid="card-open-transaction"]')[0])).toBe('Balance Reconciliation');
    });

    it('should mark a transfer with the Transfer pill and a grey amount', () => {
      // act
      render([txn({ id: 1, type: TransactionType.TRANSFER, category: null as never })]);

      // assert & verify
      expect(all('[data-testid="card-transfer-pill"]').length).toBe(1);
      expect(all('[data-testid="card-choose-category"]').length).toBe(0);
      expect(cards()[0].querySelector('.text-surface-500')).not.toBeNull();
    });

    it('should show tag chips only on cards that have tags, even in compact mode', () => {
      // act
      render(
        [
          txn({
            id: 1,
            tags: [
              { id: 1, name: 'weekly' },
              { id: 2, name: 'fun' },
            ] as never,
          }),
          txn({ id: 2 }),
        ],
        { compact: true },
      );

      // assert & verify
      expect(all('[data-testid="card-tags"]').length).toBe(1);
      expect(text(all('[data-testid="card-tags"]')[0])).toBe('weeklyfun');
    });

    it('should offer Choose category on an uncategorized card without opening it', () => {
      // arrange
      const rows = [txn({ id: 1, category: null as never })];
      render(rows);
      const opened = vi.fn();
      const picked = vi.fn();
      component.openTransaction.subscribe(opened);
      component.pickCategory.subscribe(picked);

      // act
      all<HTMLButtonElement>('[data-testid="card-choose-category"]')[0].click();

      // assert & verify
      expect(picked).toHaveBeenCalledWith(rows[0]);
      expect(opened).not.toHaveBeenCalled();
    });

    it('should open a transaction when its card is activated, but not from the checkbox', () => {
      // arrange
      const rows = [txn({ id: 1 }), txn({ id: 2 })];
      render(rows);
      const opened = vi.fn();
      component.openTransaction.subscribe(opened);

      // act
      cards()[1].click();
      all<HTMLInputElement>('[data-testid="card-row-checkbox"]')[0].click();
      all<HTMLButtonElement>('[data-testid="card-open-transaction"]')[0].click();

      // assert & verify -- the name button opens once (its click does not also reach the card)
      expect(opened.mock.calls.map((c) => c[0])).toEqual([rows[1], rows[0]]);
    });

    it('should start a rule from a card without opening or selecting it', () => {
      // arrange
      const rows = [txn({ id: 1, description: 'NETFLIX.COM' })];
      render(rows);
      const created = vi.fn();
      const opened = vi.fn();
      component.createRule.subscribe(created);
      component.openTransaction.subscribe(opened);

      // act
      ruleButtons('[data-testid="card-list"]')[0].click();

      // assert & verify
      expect(created).toHaveBeenCalledWith(rows[0]);
      expect(opened).not.toHaveBeenCalled();
    });

    it('should select with the card checkbox, name it like the row checkbox, and select a shift-click range', () => {
      // arrange
      render([txn({ id: 1 }), txn({ id: 2 }), txn({ id: 3 }), txn({ id: 4 })], {
        selectedIds: [4],
      });
      const changed = vi.fn();
      component.selectionChange.subscribe(changed);
      const boxes = all<HTMLInputElement>('[data-testid="card-row-checkbox"]');

      // act
      boxes[0].click();
      boxes[2].dispatchEvent(new MouseEvent('click', { shiftKey: true, bubbles: true }));

      // assert & verify
      expect(boxes[0].getAttribute('aria-label')).toBe('Select Whole Foods, $10.00, 2026-10-17');
      expect(changed).toHaveBeenNthCalledWith(1, [4, 1]);
      expect(changed).toHaveBeenLastCalledWith([4, 1, 2, 3]);
    });

    it('should give a selected card the selected background, and check its checkbox', () => {
      // act
      render([txn({ id: 1 }), txn({ id: 2 })], { selectedIds: [1] });

      // assert & verify
      expect(cards()[0].className).toContain('bg-primary-50');
      expect(cards()[0].className).toContain('dark:bg-primary-900/30');
      expect(cards()[1].className).not.toContain('bg-primary-50');
      const boxes = all<HTMLInputElement>('[data-testid="card-row-checkbox"]');
      expect([boxes[0].checked, boxes[1].checked]).toEqual([true, false]);
    });

    it('should keep the day headings and select the whole page from the card sort bar', () => {
      // arrange
      render([txn({ id: 1, date: '2026-10-17' }), txn({ id: 2, date: '2026-10-15' })]);
      const changed = vi.fn();
      component.selectionChange.subscribe(changed);

      // act
      all<HTMLInputElement>('[data-testid="card-header-checkbox"]')[0].click();

      // assert & verify
      expect(all('[data-testid="card-day-heading"]').length).toBe(2);
      expect(text(all('[data-testid="card-day-heading"]')[0])).toBe(
        text(all('[data-testid="day-heading"]')[0]),
      );
      expect(changed).toHaveBeenLastCalledWith([1, 2]);
    });

    it('should list cards flat, with no day headings, when sorted by something other than date', () => {
      // act
      render([txn({ id: 1 }), txn({ id: 2 })], { sort: 'amount,desc' });

      // assert & verify
      expect(all('[data-testid="card-day-heading"]').length).toBe(0);
      expect(cards().length).toBe(2);
    });

    describe('sort bar', () => {
      const field = (): HTMLSelectElement =>
        all<HTMLSelectElement>('[data-testid="card-sort-field"]')[0];
      const direction = (): HTMLButtonElement =>
        all<HTMLButtonElement>('[data-testid="card-sort-direction"]')[0];

      it('should offer the same sorts as the table headers, plus Date', () => {
        // act
        render([txn({ id: 1 })]);

        // assert & verify
        expect(Array.from(field().options).map((o) => o.textContent?.trim())).toEqual([
          'Date',
          'Description',
          'Merchant',
          'Category',
          'Account',
          'Amount',
        ]);
        expect(field().value).toBe('date');
      });

      it('should drop Description in compact mode, as the table does', () => {
        // act
        render([txn({ id: 1 })], { compact: true });

        // assert & verify
        expect(Array.from(field().options).map((o) => o.textContent?.trim())).not.toContain(
          'Description',
        );
      });

      it('should sort by a chosen field, starting descending, and back to Date', () => {
        // arrange
        render([txn({ id: 1 })], { sort: 'amount,asc' });
        const sorted = vi.fn();
        component.sortChange.subscribe(sorted);
        expect(field().value).toBe('amount');

        // act
        field().value = 'category.name';
        field().dispatchEvent(new Event('change'));

        // assert & verify
        expect(sorted).toHaveBeenLastCalledWith('category.name,desc');

        // act
        field().value = 'date';
        field().dispatchEvent(new Event('change'));

        // assert & verify
        expect(sorted).toHaveBeenLastCalledWith('date,desc');
      });

      it('should flip the direction and say which way it is sorted', () => {
        // arrange
        render([txn({ id: 1 })], { sort: 'amount,desc' });
        const sorted = vi.fn();
        component.sortChange.subscribe(sorted);

        // assert -- the name states the current sort
        expect(direction().getAttribute('aria-label')).toBe(
          'Sorted descending. Switch to ascending',
        );

        // act
        direction().click();

        // assert & verify
        expect(sorted).toHaveBeenLastCalledWith('amount,asc');

        // act
        render([txn({ id: 1 })], { sort: 'amount,asc' });

        // assert & verify
        expect(direction().getAttribute('aria-label')).toBe(
          'Sorted ascending. Switch to descending',
        );
      });
    });

    it('should be hidden on a wide screen while the table is shown, and the reverse on a phone', async () => {
      // arrange
      render([txn({ id: 1 })]);
      document.body.appendChild(fixture.nativeElement);
      const { page } = await import('vitest/browser');
      const before = { width: window.innerWidth, height: window.innerHeight };
      const shown = (selector: string): boolean =>
        fixture.nativeElement.querySelector(selector).checkVisibility();

      try {
        // act & assert
        await page.viewport(640, 800);
        expect(shown('table')).toBe(true);
        expect(shown('[data-testid="card-list"]')).toBe(false);
        expect(shown('[data-testid="card-sort-bar"]')).toBe(false);

        await page.viewport(639, 800);
        expect(shown('table')).toBe(false);
        expect(shown('[data-testid="card-list"]')).toBe(true);
        expect(shown('[data-testid="card-sort-bar"]')).toBe(true);
      } finally {
        await page.viewport(before.width, before.height);
        fixture.nativeElement.remove();
      }
    });

    it('should show skeleton cards while loading with no rows, and nothing for an empty list', () => {
      // act
      render([], { loading: true });

      // assert & verify
      expect(all('[data-testid="card-skeleton-row"]').length).toBeGreaterThan(0);

      // act
      render([]);

      // assert & verify
      expect(all('[data-testid="card-skeleton-row"]').length).toBe(0);
      expect(cards().length).toBe(0);
    });

    it('should dim the cards with the table while new results load', () => {
      // act
      render([txn({ id: 1 })], { loading: true });

      // assert & verify -- one wrapper holds both layouts
      const wrapper = fixture.nativeElement.firstElementChild as HTMLElement;
      expect(wrapper.contains(cards()[0])).toBe(true);
      expect(wrapper.className).toContain('opacity-60');
      expect(wrapper.className).toContain('pointer-events-none');
    });
  });
});
