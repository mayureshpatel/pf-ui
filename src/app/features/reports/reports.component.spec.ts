import { vi, Mocked } from 'vitest';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { Observable, of, Subject, throwError } from 'rxjs';
import { Account } from '@models/account.model';
import { Category } from '@models/category.model';
import { Merchant } from '@models/merchant.model';
import { Tag } from '@models/tag.model';
import { PageResponse } from '@models/transaction.model';
import { AccountApiService } from '@features/accounts/services/account-api.service';
import { CategoryApiService } from '@features/categories/services/category-api.service';
import { MerchantApiService } from '@features/merchants/services/merchant-api.service';
import { TagApiService } from '@features/tags/services/tag-api.service';
import { ToastService } from '@core/services/toast.service';
import { ReportsComponent } from './reports.component';
import { ReportApiService } from './services/report-api.service';
import {
  ExploreResult,
  ExploreRow,
  ExploreTransaction,
  ExploreTrend,
} from './models/reports.model';

const row = (
  key: string | null,
  label: string,
  value: number,
  comparison: number | null = null,
): ExploreRow => ({
  key,
  label,
  value,
  comparisonValue: comparison,
  count: 2,
});
const result = (
  rows: ExploreRow[] = [row('5', 'Food', 400, 300), row('6', 'Rent', 900, 900)],
): ExploreResult => ({
  rows,
  total: rows.reduce((t, r) => t + (r.value ?? 0), 0),
  comparisonTotal: null,
  totalCount: 4,
  excludedCount: 38,
  comparisonStart: null,
  comparisonEnd: null,
  comparisonLabel: null,
  inProgress: true,
});
const trend: ExploreTrend = {
  current: [
    { start: '2026-01-01', value: 100, partial: false },
    { start: '2026-02-01', value: 200, partial: false },
  ],
  comparison: [],
};
const tx = (id: number): ExploreTransaction => ({
  id,
  date: '2026-10-18',
  description: 'WHOLEFDS',
  merchantName: 'Whole Foods',
  accountName: 'Checking',
  categoryName: 'Groceries',
  amount: 84.12,
  type: 'EXPENSE',
});
const page = (items: ExploreTransaction[]): PageResponse<ExploreTransaction> => ({
  content: items,
  page: { totalElements: items.length, totalPages: 1, number: 0, size: 20 },
});

describe('ReportsComponent', () => {
  let fixture: ComponentFixture<ReportsComponent>;
  let component: ReportsComponent;
  let api: Mocked<Pick<ReportApiService, 'explore' | 'trend' | 'transactions' | 'getNetWorth'>>;
  let router: Mocked<Pick<Router, 'navigate' | 'createUrlTree' | 'serializeUrl'>>;
  let toast: Mocked<Pick<ToastService, 'success' | 'error'>>;
  let queryParams: Subject<Params>;
  let snapshotParams: Params;

  async function create(params: Params = {}): Promise<void> {
    snapshotParams = params;
    fixture = TestBed.createComponent(ReportsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const lastExploreState = () => api.explore.mock.calls.at(-1)![0];
  const text = (): string => fixture.nativeElement.textContent.replace(/\s+/g, ' ');

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 25, 12));
    queryParams = new Subject<Params>();
    snapshotParams = {};
    router = {
      navigate: vi.fn().mockResolvedValue(true),
      createUrlTree: vi.fn().mockReturnValue({}),
      serializeUrl: vi.fn().mockReturnValue('/reports?measure=SPENDING'),
    };
    toast = { success: vi.fn(), error: vi.fn() };
    api = {
      explore: vi.fn().mockReturnValue(of(result())),
      trend: vi.fn().mockReturnValue(of(trend)),
      transactions: vi.fn().mockReturnValue(of(page([tx(1)]))),
      getNetWorth: vi.fn().mockReturnValue(of([])),
    };

    await TestBed.configureTestingModule({
      imports: [ReportsComponent, NoopAnimationsModule],
      providers: [
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            get snapshot() {
              return { queryParams: snapshotParams };
            },
            queryParams,
          },
        },
        { provide: ReportApiService, useValue: api },
        { provide: ToastService, useValue: toast },
        {
          provide: AccountApiService,
          useValue: {
            getAccounts: vi.fn().mockReturnValue(of([{ id: 1, name: 'Checking' }] as Account[])),
          },
        },
        {
          provide: CategoryApiService,
          useValue: {
            getCategories: vi.fn().mockReturnValue(
              of([
                { id: 5, name: 'Food', parent: null },
                { id: 8, name: 'Groceries', parent: { id: 5 } },
                { id: 10, name: 'Gas', parent: { id: 6 } },
                { id: 11, name: 'Gas & Electric', parent: { id: 6 } },
              ] as Category[]),
            ),
          },
        },
        {
          provide: TagApiService,
          useValue: { getTags: vi.fn().mockReturnValue(of([{ id: 3, name: 'Trip' }] as Tag[])) },
        },
        {
          provide: MerchantApiService,
          useValue: {
            getMerchants: vi.fn().mockReturnValue(
              of({
                content: [{ id: 9, name: 'Whole Foods' }] as Merchant[],
                page: { totalElements: 1, totalPages: 1, number: 0, size: 20 },
              }),
            ),
          },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should open on the default view and load results and trend', async () => {
    // act
    await create();

    // assert & verify
    expect(api.explore).toHaveBeenCalledTimes(1);
    expect(api.trend).toHaveBeenCalledTimes(1);
    expect(lastExploreState().measure).toBe('SPENDING');
    expect(lastExploreState().groupBy).toBe('CATEGORY');
    expect(lastExploreState().startDate).toBe('2026-01-01');
    expect(component.result()?.rows).toHaveLength(2);
    expect(component.loadedOnce()).toBe(true);
    expect(text()).toContain('Food');
    expect(text()).toContain('Transfers excluded, 38 left out');
  });

  it('should hydrate from the URL and write every change back', async () => {
    // arrange
    await create({
      measure: 'INCOME',
      groupBy: 'MERCHANT',
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    });

    // act
    component.onStateChange({ groupBy: 'ACCOUNT' });
    await settle();

    // assert & verify
    expect(lastExploreState().measure).toBe('INCOME');
    expect(router.navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({
        queryParams: expect.objectContaining({
          measure: 'INCOME',
          groupBy: 'ACCOUNT',
          startDate: '2026-03-01',
        }),
        replaceUrl: true,
      }),
    );
  });

  it('should follow the URL when it changes underneath, without writing it back', async () => {
    // arrange
    await create();
    router.navigate.mockClear();

    // act
    queryParams.next({
      measure: 'COUNT',
      groupBy: 'TAG',
      startDate: '2026-02-01',
      endDate: '2026-02-28',
    });
    await settle();

    // assert & verify
    expect(component.state().measure).toBe('COUNT');
    expect(lastExploreState().groupBy).toBe('TAG');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should fall back with a note for an invalid URL', async () => {
    // act
    await create({ groupBy: 'BOGUS' });

    // assert & verify
    expect(component.state().groupBy).toBe('CATEGORY');
    expect(component.note()).not.toBeNull();
    expect(text()).toContain('defaults were applied');
  });

  it('should drill into a row, add its chip, advance the grouping and announce it', async () => {
    // arrange
    await create();

    // act
    component.onDrill(row('5', 'Food', 400));
    await settle();

    // assert & verify
    expect(component.state().filters.categoryId).toBe(5);
    expect(component.state().groupBy).toBe('SUBCATEGORY');
    expect(lastExploreState().filters.categoryId).toBe(5);
    expect(component.announcement()).toBe('Showing Food by subcategory');
    expect(text()).toContain('Category: Food');
    expect(fixture.nativeElement.querySelector('[aria-live="polite"]').textContent).toContain(
      'Showing Food by subcategory',
    );
  });

  it('should show the transaction list when the grouping is exhausted', async () => {
    // arrange
    await create();

    // act
    component.onDrill(row('5', 'Food', 400));
    component.onDrill(row('8', 'Groceries', 300));
    component.onDrill(row('9', 'Whole Foods', 200));
    await settle();

    // assert & verify
    expect(component.state().leaf).toBe(true);
    expect(api.transactions).toHaveBeenCalled();
    expect(fixture.debugElement.query(By.css('app-transaction-list'))).not.toBeNull();
    expect(fixture.debugElement.query(By.css('app-results-table'))).toBeNull();
    expect(component.announcement()).toBe('Showing the transactions for Whole Foods');
  });

  it('should step back through the breadcrumb and keep non-drill filters', async () => {
    // arrange
    await create();
    component.onFiltersChange({ accountIds: [1] });
    component.onDrill(row('5', 'Food', 400));
    component.onDrill(row('8', 'Groceries', 300));

    // act
    component.onStepBack(1);
    await settle();

    // assert & verify
    expect(component.state().filters.categoryId).toBe(5);
    expect(component.state().filters.accountIds).toEqual([1]);
    expect(component.state().drill.map((s) => s.label)).toEqual(['Food']);
    expect(component.state().groupBy).toBe('SUBCATEGORY');
    expect(component.crumbs()).toEqual(['All spending', 'Food']);
  });

  it('should keep filters when the grouping changes mid-drill', async () => {
    // arrange
    await create();
    component.onDrill(row('5', 'Food', 400));

    // act
    component.onStateChange({ groupBy: 'MERCHANT', leaf: false });
    await settle();

    // assert & verify
    expect(component.state().filters.categoryId).toBe(5);
    expect(component.state().groupBy).toBe('MERCHANT');
    expect(lastExploreState().filters.categoryId).toBe(5);
  });

  it('should filter to a row without changing the grouping', async () => {
    // arrange
    await create();

    // act
    component.onFilterOnly(row('5', 'Food', 400));
    await settle();

    // assert & verify
    expect(component.state().groupBy).toBe('CATEGORY');
    expect(component.state().filters.categoryId).toBe(5);
    expect(component.state().leaf).toBe(false);
  });

  it('should open the transactions behind a row from its menu', async () => {
    // arrange
    await create();

    // act
    component.onOpenTransactions(row('5', 'Food', 400));
    await settle();

    // assert & verify
    expect(component.state().leaf).toBe(true);
    expect(component.state().groupBy).toBe('CATEGORY');
    expect(api.transactions).toHaveBeenCalled();
  });

  it('should filter to a month when a trend bar is clicked', async () => {
    // arrange
    await create();

    // act
    component.onSelectBucket({ start: '2026-02-01', value: 200, partial: false });
    await settle();

    // assert & verify
    expect(component.state().period).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
      label: 'Feb 2026',
    });
    expect(lastExploreState().period?.start).toBe('2026-02-01');
    expect(text()).toContain('Period: Feb 2026');
    expect(component.state().groupBy).toBe('CATEGORY');
  });

  it('should drop a period and its step when the range changes', async () => {
    // arrange
    await create();
    component.onSelectBucket({ start: '2026-02-01', value: 200, partial: false });

    // act
    component.onStateChange({
      startDate: '2026-01-01',
      endDate: '2026-06-30',
      rangeLabel: 'Custom',
    });
    await settle();

    // assert & verify
    expect(component.state().period).toBeNull();
    expect(component.state().drill).toEqual([]);
    expect(component.state().endDate).toBe('2026-06-30');
  });

  it('should switch to Month when the measure rules out the grouping', async () => {
    // arrange
    await create();

    // act
    component.onStateChange({ measure: 'NET' });
    await settle();

    // assert & verify
    expect(component.state().groupBy).toBe('MONTH');
    expect(lastExploreState().measure).toBe('NET');
  });

  it('should sort by date in a time grouping and back by total when leaving it', async () => {
    // arrange
    await create();

    // act
    component.onStateChange({ groupBy: 'MONTH' });
    const inMonths = component.state().sort;
    component.onStateChange({ groupBy: 'CATEGORY' });

    // assert & verify
    expect(inMonths).toBe('name');
    expect(component.state().sort).toBe('value');
  });

  it('should send the comparison and show its label', async () => {
    // arrange
    api.explore.mockReturnValue(
      of({
        ...result([row('5', 'Food', 400, 300)]),
        comparisonTotal: 300,
        comparisonLabel: 'same days last year (Jan 1 to Oct 25, 2025)',
      }),
    );
    await create();

    // act
    component.onStateChange({ compare: 'SAME_DAYS_LAST_YEAR' });
    await settle();

    // assert & verify
    expect(lastExploreState().compare).toBe('SAME_DAYS_LAST_YEAR');
    expect(text()).toContain('same days last year (Jan 1 to Oct 25, 2025)');
    expect(text()).toContain('Biggest increase');
  });

  it('should drop a slower response from an earlier state', async () => {
    // arrange
    const slow = new Subject<ExploreResult>();
    const fast = new Subject<ExploreResult>();
    api.explore.mockReturnValueOnce(slow).mockReturnValueOnce(fast);
    await create();

    // act
    component.onStateChange({ groupBy: 'MERCHANT' });
    fast.next(result([row('9', 'Whole Foods', 50)]));
    fast.complete();
    slow.next(result([row('5', 'Food', 999)]));
    slow.complete();
    await settle();

    // assert & verify
    expect(component.result()?.rows[0].label).toBe('Whole Foods');
    expect(component.loading()).toBe(false);
  });

  it('should show the error page and clear stale rows when loading fails, and retry', async () => {
    // arrange
    await create();
    api.explore.mockReturnValueOnce(throwError(() => new Error('boom')));

    // act
    component.onStateChange({ groupBy: 'MERCHANT' });
    await settle();
    const failed = fixture.debugElement.query(By.css('app-page-error-state'));
    const rowsAfterFailure = component.result();
    api.explore.mockReturnValue(of(result()));
    failed.componentInstance.retry.emit();
    await settle();

    // assert & verify
    expect(failed).not.toBeNull();
    expect(rowsAfterFailure).toBeNull();
    expect(component.loadError()).toBe(false);
    expect(component.result()?.rows).toHaveLength(2);
  });

  it('should show the empty state with Clear filters', async () => {
    // arrange
    await create();
    component.onFiltersChange({ accountIds: [1], minAmount: 5000 });
    api.explore.mockReturnValue(of(result([])));
    component.onStateChange({ groupBy: 'MERCHANT' });
    await settle();

    // act
    const clear = (
      Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]
    ).find((b) => b.textContent?.includes('Clear filters'))!;
    clear.click();
    await settle();

    // assert & verify
    expect(clear).toBeDefined();
    expect(text()).not.toContain('Nothing matches');
    expect(component.state().filters).toEqual({ accountIds: [] });
  });

  it('should say there is nothing to show when nothing is filtered', async () => {
    // arrange
    api.explore.mockReturnValue(of(result([])));

    // act
    await create();

    // assert & verify
    expect(text()).toContain('No spending in this period');
    expect(text()).not.toContain('Clear filters');
  });

  it('should show no savings rate when there is no income', async () => {
    // arrange
    api.explore.mockReturnValue(
      of({ ...result([]), total: null, rows: [row('2026-01-01', 'Jan 2026', 0)] }),
    );
    await create({
      measure: 'SAVINGS_RATE',
      groupBy: 'MONTH',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });

    // assert & verify
    expect(text()).toContain('No income in this period, so there is no savings rate.');
  });

  it('should enable Open in Transactions only when the filters fit and map them', async () => {
    // arrange
    await create();
    component.onFiltersChange({ accountIds: [1], categoryId: 8, categoryName: 'Groceries' });
    component.onStateChange({ groupBy: 'MERCHANT' });
    component.onOpenTransactions(row('9', 'Whole Foods', 50));
    await settle();
    const open = (): HTMLButtonElement =>
      (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find(
        (b) => b.textContent?.includes('Open in Transactions'),
      )!;

    // act
    const enabled = !open().disabled;
    component.openInTransactions();
    component.onFiltersChange({ accountIds: [1, 2], categoryId: 8, categoryName: 'Groceries' });
    await settle();

    // assert & verify
    expect(enabled).toBe(true);
    expect(router.navigate).toHaveBeenCalledWith(
      ['/transactions'],
      expect.objectContaining({
        queryParams: expect.objectContaining({
          accountId: '1',
          categoryName: 'Groceries',
          merchant: 'Whole Foods',
          type: 'EXPENSE',
        }),
      }),
    );
    expect(open().disabled).toBe(true);
    expect(text()).toContain("can't show several accounts at once");
  });

  it('should build a CSV of every row with a header line naming the range', async () => {
    // arrange
    const many = Array.from({ length: 13 }, (_, i) => row(String(i + 1), `Row ${i + 1}`, 100 - i));
    api.explore.mockReturnValue(of(result(many)));
    await create();

    // act
    const rows = component.csvRows();

    // assert & verify
    expect(rows[0][0]).toContain('Spending by category');
    expect(rows[0][0]).toContain('Jan 1 to Oct 25, 2026');
    expect(rows[2]).toEqual(['Category', 'Spending', 'Comparison', 'Change', 'Count']);
    expect(rows).toHaveLength(3 + 13);
    expect(rows[3]).toEqual(['Row 1', '100.00', '', '', '2']);
  });

  it('should download the CSV under a descriptive name', async () => {
    // arrange
    await create();
    let filename = '';
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ): void {
      filename = this.download;
    });

    // act
    component.exportCsv();

    // assert & verify
    expect(filename).toBe('reports_spending-by-category_2026-01-01_to_2026-12-31.csv');
  });

  it('should copy the link and say so', async () => {
    // arrange
    await create();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    // act
    await component.copyLink();

    // assert & verify
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/reports?measure=SPENDING'));
    expect(toast.success).toHaveBeenCalledWith('Link copied');
  });

  it('should keep results visible and dimmed while re-querying', async () => {
    // arrange
    await create();
    const pending = new Subject<ExploreResult>();
    api.explore.mockReturnValueOnce(pending);

    // act
    component.onStateChange({ groupBy: 'MERCHANT' });
    await settle();

    // assert & verify
    expect(component.loading()).toBe(true);
    expect(component.result()?.rows).toHaveLength(2);
    expect(
      fixture.nativeElement.querySelector('app-results-table [aria-busy="true"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.querySelector('p-skeleton')).toBeNull();
  });

  it('should move focus to the results heading after a drill', async () => {
    // arrange
    await create();
    document.body.appendChild(fixture.nativeElement);

    // act
    component.onDrill(row('5', 'Food', 400));
    await settle();
    await new Promise((resolve) => setTimeout(resolve));

    // assert & verify
    expect(document.activeElement?.id).toBe('results-heading');
    fixture.nativeElement.remove();
  });

  it('should switch to the net worth view and write it to the URL', async () => {
    // arrange
    await create();

    // act
    component.setView('networth');
    await settle();

    // assert & verify
    expect(fixture.debugElement.query(By.css('app-net-worth-report'))).not.toBeNull();
    expect(fixture.debugElement.query(By.css('app-explorer-controls'))).toBeNull();
    expect(router.navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: expect.objectContaining({ view: 'networth' }) }),
    );
  });

  it('should hydrate the net worth view from the URL', async () => {
    // act
    await create({ view: 'networth' });

    // assert & verify
    expect(component.view()).toBe('networth');
    expect(api.explore).not.toHaveBeenCalled();
  });

  it('should page the transaction list', async () => {
    // arrange
    await create();
    component.onOpenTransactions(row('5', 'Food', 400));
    await settle();

    // act
    component.onPageChange(2);
    await settle();

    // assert & verify
    expect(api.transactions).toHaveBeenLastCalledWith(expect.anything(), 2, 20);
  });

  it('should list the filter lookups and look merchants up as the user searches', async () => {
    // arrange
    await create();
    const merchantApi = TestBed.inject(MerchantApiService) as unknown as Mocked<
      Pick<MerchantApiService, 'getMerchants'>
    >;

    // act
    component.onMerchantSearch('whole');

    // assert & verify
    expect(component.accounts()).toHaveLength(1);
    expect(component.categories()).toHaveLength(4);
    expect(component.tags()).toHaveLength(1);
    expect(component.merchants()).toHaveLength(1);
    expect(merchantApi.getMerchants).toHaveBeenLastCalledWith(
      'whole',
      expect.objectContaining({ page: 0 }),
    );
  });

  it('should carry on when a lookup fails', async () => {
    // arrange
    const tags = TestBed.inject(TagApiService) as unknown as Mocked<Pick<TagApiService, 'getTags'>>;
    tags.getTags.mockReturnValue(throwError(() => new Error('nope')) as Observable<Tag[]>);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // act
    await create();

    // assert & verify
    expect(component.tags()).toEqual([]);
    expect(component.result()?.rows).toHaveLength(2);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('should not offer Open in Transactions for a whole category group or an ambiguous name', async () => {
    // arrange
    await create();
    const linkable = () => component['linkable']();

    // act
    component.onFiltersChange({ accountIds: [], categoryId: 5, categoryName: 'Food' });
    const parent = linkable();
    component.onFiltersChange({ accountIds: [], categoryId: 10, categoryName: 'Gas' });
    const similar = linkable();
    component.onFiltersChange({ accountIds: [], categoryId: 8, categoryName: 'Groceries' });
    const fine = linkable();
    component.onOpenTransactions(row('5', 'Food', 1));
    component.openInTransactions();
    router.navigate.mockClear();
    component.onFiltersChange({ accountIds: [], categoryId: 5, categoryName: 'Food' });
    component.openInTransactions();

    // assert & verify
    expect(parent.ok).toBe(false);
    expect(parent.reason).toContain('whole category group');
    expect(similar.ok).toBe(false);
    expect(similar.reason).toContain('similar names');
    expect(fine.ok).toBe(true);
    expect(router.navigate).not.toHaveBeenCalledWith(['/transactions'], expect.anything());
  });

  // PF-888
  it('should check merchant ambiguity against every merchant, not just the ones loaded for the filter', async () => {
    // arrange -- only "Whole Foods" is in the loaded list, but "Whole Foods Market" exists too
    await create();
    const merchantApi = TestBed.inject(MerchantApiService) as unknown as Mocked<
      Pick<MerchantApiService, 'getMerchants'>
    >;
    merchantApi.getMerchants.mockImplementation(((term: string | null) =>
      of({
        content: (term === 'Whole Foods'
          ? [
              { id: 9, name: 'Whole Foods' },
              { id: 12, name: 'Whole Foods Market' },
            ]
          : [{ id: 9, name: 'Whole Foods' }]) as Merchant[],
        page: { totalElements: 2, totalPages: 1, number: 0, size: 20 },
      })) as never);

    // act
    component.onFiltersChange({ accountIds: [], merchantId: 9, merchantName: 'Whole Foods' });
    await settle();

    // assert & verify
    const linkable = component['linkable']();
    expect(linkable.ok).toBe(false);
    expect(linkable.reason).toContain('similar names');
  });

  it('should still offer Open in Transactions for a merchant whose name is unique', async () => {
    // arrange
    await create();

    // act
    component.onFiltersChange({ accountIds: [], merchantId: 9, merchantName: 'Whole Foods' });
    await settle();

    // assert & verify
    expect(component['linkable']().ok).toBe(true);
  });

  it('should show an inline retry, not nothing, when the trend fails to load', async () => {
    // arrange
    api.trend.mockReturnValue(throwError(() => new Error('down')));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // act
    await create();

    // assert & verify -- the rest of the report is still there
    expect(fixture.nativeElement.querySelector('[data-testid="trend-failed"]')).toBeTruthy();
    expect(text()).toContain("Couldn't load the trend");
    expect(text()).toContain('Food');

    // act -- retry succeeds
    api.trend.mockReturnValue(of(trend));
    (
      fixture.nativeElement.querySelector(
        '[data-testid="trend-failed"] button',
      ) as HTMLButtonElement
    ).click();
    await settle();

    // assert & verify
    expect(fixture.nativeElement.querySelector('[data-testid="trend-failed"]')).toBeNull();
    expect(api.trend).toHaveBeenCalledTimes(2);
  });

  it('should show an inline retry when the transactions page fails to load at the leaf', async () => {
    // arrange
    await create();
    api.transactions.mockReturnValue(throwError(() => new Error('down')));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // act
    component.onOpenTransactions(row('5', 'Food', 400));
    await settle();

    // assert & verify
    expect(fixture.nativeElement.querySelector('[data-testid="leaf-failed"]')).toBeTruthy();
    expect(text()).toContain("Couldn't load the transactions");
  });

  it('should drop a drill step from the link that has no matching filter, with a note', async () => {
    // act
    await create({ drill: ['CATEGORY|categoryId|5|%7B%7D|Food'] });

    // assert & verify
    expect(component.state().drill).toEqual([]);
    expect(component.note()).toContain('drill');
  });

  it('should push a history entry for a drill so Back steps out, and replace for other changes', async () => {
    // arrange
    await create();
    router.navigate.mockClear();

    // act
    component.onDrill(row('5', 'Food', 400));
    await settle();
    const afterDrill = router.navigate.mock.calls.at(-1)![1];
    component.onStateChange({ compare: 'PREVIOUS_PERIOD' });
    await settle();
    const afterCompare = router.navigate.mock.calls.at(-1)![1];

    // assert & verify
    expect(afterDrill?.replaceUrl).toBe(false);
    expect(afterCompare?.replaceUrl).toBe(true);
  });

  it('should step back one level on Escape, but not while typing or with nothing to step back', async () => {
    // arrange
    await create();
    component.onDrill(row('5', 'Food', 400));
    component.onDrill(row('8', 'Groceries', 300));
    await settle();
    const press = (target: EventTarget): void => {
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    };

    // act
    const input = document.createElement('input');
    document.body.appendChild(input);
    press(input);
    const whileTyping = component.state().drill.length;
    press(document.body);
    const afterOne = component.state().drill.length;
    press(document.body);
    press(document.body);
    input.remove();

    // assert & verify
    expect(whileTyping).toBe(2);
    expect(afterOne).toBe(1);
    expect(component.state().drill).toEqual([]);
  });
});
