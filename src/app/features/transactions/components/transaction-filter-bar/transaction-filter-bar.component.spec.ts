import { Mock, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransactionFilter } from '@models/transaction.model';
import { TransactionFilterBarComponent } from './transaction-filter-bar.component';

describe('TransactionFilterBarComponent', () => {
  let fixture: ComponentFixture<TransactionFilterBarComponent>;
  let emitted: Mock<(filter: TransactionFilter) => void>;

  function render(filter: TransactionFilter, resultCount: number | null = 47): void {
    fixture.componentRef.setInput('filter', filter);
    fixture.componentRef.setInput('accounts', [{ id: 3, name: 'Checking' }]);
    fixture.componentRef.setInput('tags', [{ id: 7, name: 'weekly' }]);
    fixture.componentRef.setInput('groupedCategories', []);
    fixture.componentRef.setInput('merchantNames', ['Shell']);
    fixture.componentRef.setInput('resultCount', resultCount);
    fixture.detectChanges();
  }

  const q = <T extends HTMLElement>(selector: string): T =>
    fixture.nativeElement.querySelector(selector) as T;

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [TransactionFilterBarComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TransactionFilterBarComponent);
    emitted = vi.fn<(filter: TransactionFilter) => void>();
    fixture.componentInstance.filterChange.subscribe(emitted);
  });

  afterEach(() => vi.useRealTimers());

  it('should show the result count in plain words', () => {
    // act
    render({}, 47);

    // assert & verify
    expect(q('[data-testid="result-line"]').textContent?.trim()).toBe('47 transactions match');
  });

  it('should use the singular for one match and show nothing while the count is unknown', () => {
    // act
    render({}, 1);
    // assert & verify
    expect(q('[data-testid="result-line"]').textContent?.trim()).toBe('1 transaction matches');

    // act
    render({}, null);
    // assert & verify
    expect(q('[data-testid="result-line"]')).toBeNull();
  });

  it('should render one removable chip per applied filter and remove it on click', () => {
    // arrange
    render({ accountId: 3, categoryName: 'Groceries', description: 'shell' });
    const chips = fixture.nativeElement.querySelectorAll('[data-testid="filter-chip"]');

    // assert & verify
    expect(Array.from<HTMLElement>(chips).map((c) => c.textContent?.trim())).toEqual([
      'Checking',
      'Groceries',
    ]);

    // act
    (chips[0].querySelector('button') as HTMLButtonElement).click();

    // assert & verify -- the period and search survive, only the chip's filter is cleared
    expect(emitted).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: undefined, categoryName: 'Groceries', description: 'shell' }),
    );
  });

  it('should clear every filter but keep the period when Clear all is used', () => {
    // arrange
    const start = new Date(2026, 9, 1);
    const end = new Date(2026, 9, 31);
    render({ accountId: 3, description: 'shell', startDate: start, endDate: end });

    // act
    q<HTMLButtonElement>('[data-testid="clear-all"]').click();

    // assert & verify
    expect(emitted).toHaveBeenCalledWith({ startDate: start, endDate: end });
  });

  it('should debounce search and send the text exactly as typed', () => {
    // arrange
    render({});
    const input = q<HTMLInputElement>('input[type="search"]');

    // act
    input.value = '50% off & co';
    input.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(299);

    // assert & verify
    expect(emitted).not.toHaveBeenCalled();

    // act
    vi.advanceTimersByTime(1);

    // assert & verify
    expect(emitted).toHaveBeenCalledWith({ description: '50% off & co' });
  });

  it('should clear the description when the search box is emptied', () => {
    // arrange
    render({ description: 'shell' });
    const input = q<HTMLInputElement>('input[type="search"]');

    // act
    input.value = '';
    input.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(300);

    // assert & verify
    expect(emitted).toHaveBeenCalledWith({ description: undefined });
  });

  it('should show the Filters button with the number of applied filters', () => {
    // act
    render({ accountId: 3, tagId: 7, minAmount: 20 });

    // assert & verify -- account, tag and the amount range count as three
    expect(q('[data-testid="filters-button"]').textContent).toContain('3');
  });

  it('should pick a preset from the period buttons, and show Custom range for an odd range', () => {
    // arrange
    render({ startDate: new Date(2026, 5, 1), endDate: new Date(2026, 5, 9) });

    // assert & verify -- the Custom range pickers are visible for a range that matches no preset
    expect(fixture.nativeElement.querySelectorAll('p-datepicker').length).toBe(2);
  });

  it('should clear both dates, keeping other filters, when All time is chosen', () => {
    // arrange
    render({ accountId: 3, startDate: new Date(2026, 9, 1), endDate: new Date(2026, 9, 31) });

    // act
    fixture.componentInstance.onPresetChange('ALL_TIME');

    // assert & verify
    expect(emitted).toHaveBeenCalledWith({
      accountId: 3,
      startDate: undefined,
      endDate: undefined,
    });
  });
});
