import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PageResponse } from '@models/transaction.model';
import { ExploreTransaction } from '../../models/reports.model';
import { TransactionListComponent } from './transaction-list.component';

const tx = (id: number, over: Partial<ExploreTransaction> = {}): ExploreTransaction => ({
  id,
  date: '2026-10-18',
  description: 'WHOLEFDS ROSWELL',
  merchantName: 'Whole Foods',
  accountName: 'Capital One',
  categoryName: 'Groceries',
  amount: 84.12,
  type: 'EXPENSE',
  ...over,
});
const page = (
  items: ExploreTransaction[],
  number = 0,
  totalPages = 3,
): PageResponse<ExploreTransaction> => ({
  content: items,
  page: { totalElements: 50, totalPages, number, size: 20 },
});

describe('TransactionListComponent', () => {
  let fixture: ComponentFixture<TransactionListComponent>;

  function render(
    p: PageResponse<ExploreTransaction> | null,
    linkable: { ok: boolean; reason?: string } = { ok: true },
    loading = false,
  ): void {
    fixture.componentRef.setInput('page', p);
    fixture.componentRef.setInput('linkable', linkable);
    fixture.componentRef.setInput('loading', loading);
    fixture.detectChanges();
  }

  const button = (text: string): HTMLButtonElement | undefined =>
    (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find(
      (b) => b.textContent?.includes(text),
    );

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TransactionListComponent] });
    fixture = TestBed.createComponent(TransactionListComponent);
  });

  it('should list transactions with merchant, account and amount', () => {
    // act
    render(
      page([
        tx(1),
        tx(2, { merchantName: null, description: 'MYSTERY', amount: 5, type: 'INCOME' }),
      ]),
    );

    // assert & verify
    const text = fixture.nativeElement.textContent.replace(/\s+/g, ' ');
    expect(fixture.nativeElement.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(text).toContain('Whole Foods');
    expect(text).toContain('WHOLEFDS ROSWELL');
    expect(text).toContain('Capital One');
    expect(text).toContain('$84.12');
    expect(text).toContain('MYSTERY');
    expect(text).toContain('Oct 18, 2026');
  });

  it('should page', () => {
    // arrange
    const pages: number[] = [];
    fixture.componentInstance.pageChange.subscribe((n: number) => pages.push(n));
    render(page([tx(1)], 1, 3));

    // act
    button('Next')!.click();
    button('Previous')!.click();

    // assert & verify
    expect(fixture.nativeElement.textContent).toContain('Page 2 of 3');
    expect(pages).toEqual([2, 0]);
  });

  it('should disable paging at the ends', () => {
    // act
    render(page([tx(1)], 0, 1));

    // assert & verify
    expect(button('Previous')!.disabled).toBe(true);
    expect(button('Next')!.disabled).toBe(true);
  });

  it('should open the link when the filters fit and explain when they do not', () => {
    // arrange
    let opened = 0;
    fixture.componentInstance.openInTransactions.subscribe(() => opened++);
    render(page([tx(1)]), { ok: true });

    // act
    button('Open in Transactions')!.click();
    render(page([tx(1)]), {
      ok: false,
      reason: "The Transactions page can't show several accounts at once.",
    });
    button('Open in Transactions')!.click();

    // assert & verify
    expect(opened).toBe(1);
    expect(button('Open in Transactions')!.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain("can't show several accounts at once");
  });

  it('should say when there are no transactions and mark busy while loading', () => {
    // act
    render(page([], 0, 0), { ok: true }, true);

    // assert & verify
    expect(fixture.nativeElement.textContent).toContain('No transactions');
    expect(fixture.nativeElement.querySelector('[aria-busy="true"]')).not.toBeNull();
  });
});
