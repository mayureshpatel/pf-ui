import { vi, Mocked } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, of, Subject, throwError } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { DashboardApiService } from './services/dashboard-api.service';
import { CategoryApiService } from '@features/categories/services/category-api.service';
import { ToastService } from '@core/services/toast.service';
import { TransactionApiService } from '@features/transactions/services/transaction-api.service';
import { ActionType, DashboardPulse } from '@models/dashboard.model';
import { PageResponse, Transaction } from '@models/transaction.model';
import { PulseCardComponent } from './components/pulse-card/pulse-card.component';
import { YtdSummaryComponent } from './components/ytd-summary/ytd-summary.component';
import { KeptCardComponent } from './components/kept-card/kept-card.component';
import { ReviewBannerComponent } from './components/review-banner/review-banner.component';

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let mockDashboardApi: Mocked<
    Pick<
      DashboardApiService,
      | 'getPulse'
      | 'getCashFlowTrend'
      | 'getYtdSummary'
      | 'getActionItems'
      | 'getCategoryBreakdown'
      | 'getMerchantBreakdown'
    >
  >;
  let mockToast: Mocked<Pick<ToastService, 'success' | 'error' | 'info'>>;
  let mockTransactionApi: Mocked<Pick<TransactionApiService, 'getTransactions'>>;

  /** A one-row page, shaped like the transactions endpoint's reply. */
  function latestPage(date: string | null): Observable<PageResponse<Transaction>> {
    return of({
      content: date ? [{ date }] : [],
      totalElements: date ? 1 : 0,
      totalPages: date ? 1 : 0,
      number: 0,
      size: 1,
    } as unknown as PageResponse<Transaction>);
  }

  const mockPulse: DashboardPulse = {
    currentIncome: 1000,
    previousIncome: 900,
    currentExpense: 500,
    previousExpense: 450,
    currentSavingsRate: 50,
    previousSavingsRate: 50,
  };
  const mockMerchants = [1, 2, 3, 4, 5, 6, 7].map((id) => ({
    representativeMerchantId: id,
    displayName: `Merchant ${id}`,
    total: id * 10,
    transactionCount: id,
  }));

  function setUp(now: Date): void {
    vi.useFakeTimers();
    vi.setSystemTime(now);

    mockDashboardApi = {
      getPulse: vi.fn().mockReturnValue(of(mockPulse)),
      getCashFlowTrend: vi.fn().mockReturnValue(of([])),
      getYtdSummary: vi.fn().mockReturnValue(of({})),
      getActionItems: vi.fn().mockReturnValue(of([])),
      getCategoryBreakdown: vi.fn().mockReturnValue(of([])),
      getMerchantBreakdown: vi.fn().mockReturnValue(of(mockMerchants)),
    };
    mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    mockTransactionApi = { getTransactions: vi.fn().mockReturnValue(latestPage('2026-08-31')) };

    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: DashboardApiService, useValue: mockDashboardApi },
        { provide: CategoryApiService, useValue: {} },
        { provide: ToastService, useValue: mockToast },
        { provide: TransactionApiService, useValue: mockTransactionApi },
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('default period selection', () => {
    it('should default to the previous month for a non-January current month', () => {
      // arrange -- March 15, 2026 (month index 2)
      setUp(new Date(2026, 2, 15));

      // act
      fixture.detectChanges();

      // assert & verify -- value 2 in 1-indexed monthOptions terms is February, the real
      // previous month relative to March
      expect(component.selectedMonth()).toBe(2);
      expect(component.selectedYear()).toBe(2026);
    });

    it('should wrap to December of the prior year when the current month is January', () => {
      // arrange
      setUp(new Date(2026, 0, 15));

      // act
      fixture.detectChanges();

      // assert & verify
      expect(component.selectedMonth()).toBe(12);
      expect(component.selectedYear()).toBe(2025);
    });
  });

  describe('periodRange', () => {
    beforeEach(() => {
      setUp(new Date(2026, 5, 15)); // June 15, 2026
      fixture.detectChanges();
    });

    it('should compute THIS_MONTH as the 1st of the current month through today', () => {
      // act
      component.selectedPreset.set('THIS_MONTH');

      // assert & verify
      expect(component.periodRange()).toEqual({ start: '2026-06-01', end: '2026-06-15' });
    });

    it('should compute LAST_MONTH as the full previous calendar month', () => {
      // act
      component.selectedPreset.set('LAST_MONTH');

      // assert & verify
      expect(component.periodRange()).toEqual({ start: '2026-05-01', end: '2026-05-31' });
    });

    it('should compute THIS_YEAR as Jan 1 through today', () => {
      // act
      component.selectedPreset.set('THIS_YEAR');

      // assert & verify
      expect(component.periodRange()).toEqual({ start: '2026-01-01', end: '2026-06-15' });
    });

    it('should compute LAST_YEAR as the full previous calendar year', () => {
      // act
      component.selectedPreset.set('LAST_YEAR');

      // assert & verify
      expect(component.periodRange()).toEqual({ start: '2025-01-01', end: '2025-12-31' });
    });

    it('should return null for CUSTOM, signaling month/year filtering instead of a range', () => {
      // act
      component.selectedPreset.set('CUSTOM');

      // assert & verify
      expect(component.periodRange()).toBeNull();
    });
  });

  // PF-861: the range strings are the user's local calendar days, whatever the timezone. These
  // clocks are built from local components, so the cases only differ from a UTC-based
  // conversion when the suite runs in a zone behind UTC (evening case) or ahead of it (midnight
  // case); run the suite under TZ=America/New_York and TZ=Europe/Helsinki to cover both.
  describe('periodRange local calendar days (PF-861)', () => {
    it('should end THIS_MONTH on the local date in the evening, not the next UTC day', () => {
      // arrange -- 21:00 local on Oct 16, 2026 (already Oct 17 in UTC when the zone is UTC-4)
      setUp(new Date(2026, 9, 16, 21, 0));
      fixture.detectChanges();

      // act
      component.selectedPreset.set('THIS_MONTH');

      // assert & verify
      expect(component.periodRange()).toEqual({ start: '2026-10-01', end: '2026-10-16' });
    });

    it('should cover the whole previous month for LAST_MONTH just after local midnight', () => {
      // arrange -- 00:30 local on Oct 15, 2026 (still Oct 14 in UTC when the zone is UTC+2)
      setUp(new Date(2026, 9, 15, 0, 30));
      fixture.detectChanges();

      // act
      component.selectedPreset.set('LAST_MONTH');

      // assert & verify
      expect(component.periodRange()).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    });

    it('should start THIS_YEAR on Jan 1 and LAST_YEAR on its own Jan 1 just after local midnight', () => {
      // arrange
      setUp(new Date(2026, 9, 15, 0, 30));
      fixture.detectChanges();

      // act & assert
      component.selectedPreset.set('THIS_YEAR');
      expect(component.periodRange()).toEqual({ start: '2026-01-01', end: '2026-10-15' });

      component.selectedPreset.set('LAST_YEAR');
      expect(component.periodRange()).toEqual({ start: '2025-01-01', end: '2025-12-31' });
    });
  });

  describe('loadAllData', () => {
    beforeEach(() => {
      setUp(new Date(2026, 5, 15));
    });

    it('should call getPulse with a date range for a non-custom preset', () => {
      // act
      fixture.detectChanges();
      component.selectedPreset.set('LAST_MONTH');
      fixture.detectChanges();

      // assert & verify
      expect(mockDashboardApi.getPulse).toHaveBeenCalledWith(
        undefined,
        undefined,
        '2026-05-01',
        '2026-05-31',
      );
    });

    it('should call getPulse with month/year (no range) for CUSTOM', () => {
      // act
      fixture.detectChanges();
      component.selectedPreset.set('CUSTOM');
      component.selectedMonth.set(3);
      component.selectedYear.set(2025);
      fixture.detectChanges();

      // assert & verify
      expect(mockDashboardApi.getPulse).toHaveBeenLastCalledWith(3, 2025);
    });

    it('should pass income and expenses to two pulse cards and everything else to the kept card', () => {
      // act
      fixture.detectChanges();

      // assert & verify
      const cards = fixture.debugElement.queryAll(By.directive(PulseCardComponent));
      expect(cards.length).toBe(2);
      const income = cards[0].componentInstance as PulseCardComponent;
      expect(income.value()).toBe(1000);
      expect(income.previousValue()).toBe(900);

      const expense = cards[1].componentInstance as PulseCardComponent;
      expect(expense.value()).toBe(500);
      expect(expense.previousValue()).toBe(450);

      const kept = fixture.debugElement.query(By.directive(KeptCardComponent))
        .componentInstance as KeptCardComponent;
      expect(kept.income()).toBe(1000);
      expect(kept.expense()).toBe(500);
      expect(kept.previousIncome()).toBe(900);
      expect(kept.previousExpense()).toBe(450);
      expect(kept.savingsRate()).toBe(50);
    });

    it('should pass loaded ytd data down to the ytd summary widget', () => {
      // arrange
      mockDashboardApi.getYtdSummary.mockReturnValue(
        of({
          year: 2026,
          totalIncome: 12000,
          totalExpense: 8000,
          netSavings: 4000,
          avgSavingsRate: 33.3,
        }),
      );

      // act
      fixture.detectChanges();

      // assert & verify
      const ytdSummary = fixture.debugElement.query(By.directive(YtdSummaryComponent))
        .componentInstance as YtdSummaryComponent;
      expect(ytdSummary.totalIncome()).toBe(12000);
      expect(ytdSummary.totalExpense()).toBe(8000);
      expect(ytdSummary.avgSavingsRate()).toBe(33.3);
    });

    it('should populate all signals from the loaded data', () => {
      // act
      fixture.detectChanges();

      // assert & verify
      expect(component.pulse()).toEqual(mockPulse);
      expect(component.topMerchants().length).toBe(5); // capped from the 7 mocked -- see next test
    });

    it('should keep the 5 highest-spending merchants, largest first, whatever order the API returns', () => {
      // arrange -- mockMerchants totals are 10..70 in ascending order, so a naive slice would
      // keep the 5 smallest
      // act
      fixture.detectChanges();

      // assert & verify
      expect(component.topMerchants().map((m) => m.total)).toEqual([70, 60, 50, 40, 30]);
    });

    it('should cap topMerchants to the top 5', () => {
      // act
      fixture.detectChanges();

      // assert & verify
      expect(component.topMerchants().length).toBe(5);
    });

    it('should toggle loading around the request', () => {
      // act
      fixture.detectChanges();

      // assert & verify -- of(...) resolves synchronously, so loading is already back to false
      expect(component.loading()).toBe(false);
    });

    it('should show an error toast and stop loading when the request fails', () => {
      // arrange
      mockDashboardApi.getPulse.mockReturnValue(throwError(() => new Error('network error')));

      // act
      fixture.detectChanges();

      // assert & verify
      expect(mockToast.error).toHaveBeenCalledWith('Failed to update dashboard data.');
      expect(component.loading()).toBe(false);
    });
  });

  describe('period with nothing in it', () => {
    const emptyPulse = {
      currentIncome: 0,
      previousIncome: 3157.92,
      currentExpense: 0,
      previousExpense: 7.08,
      currentSavingsRate: 0,
      previousSavingsRate: 0,
    };

    function emptyState(): HTMLElement | null {
      return fixture.nativeElement.querySelector('app-empty-period');
    }

    function arrangeEmpty(latestDate: string | null): void {
      // arrange -- November 11, 2026, so Last Month is October
      setUp(new Date(2026, 10, 11));
      mockDashboardApi.getPulse.mockReturnValue(of(emptyPulse));
      mockTransactionApi.getTransactions.mockReturnValue(latestPage(latestDate));
      fixture.detectChanges();
      // the latest-data lookup resolves inside an effect, so the template needs a second pass
      fixture.detectChanges();
    }

    it('should replace the three cards with one calm state instead of a 100% change', () => {
      // act
      arrangeEmpty('2026-08-31');

      // assert & verify
      expect(emptyState()).not.toBeNull();
      expect(fixture.debugElement.queryAll(By.directive(PulseCardComponent)).length).toBe(0);
      expect(fixture.debugElement.query(By.directive(KeptCardComponent))).toBeNull();
      expect(emptyState()?.textContent).toContain('No income or spending in October 2026');
      expect(fixture.nativeElement.textContent).not.toContain('100%');
    });

    it('should offer a jump to the latest month that has data', () => {
      // act
      arrangeEmpty('2026-08-31');

      // assert & verify
      const anchor: HTMLAnchorElement = emptyState()!.querySelector('a') as HTMLAnchorElement;
      expect(anchor.textContent?.trim()).toBe('Jump to August 2026');
      expect(anchor.getAttribute('href')).toBe('/dashboard?period=CUSTOM&month=8&year=2026');
      expect(mockTransactionApi.getTransactions).toHaveBeenCalledWith(
        {},
        { page: 0, size: 1, sort: 'date,desc' },
      );
    });

    it('should offer no jump when the account has no transactions at all', () => {
      // act
      arrangeEmpty(null);

      // assert & verify
      expect(emptyState()).not.toBeNull();
      expect(emptyState()?.querySelector('a')).toBeNull();
    });

    it('should offer no jump when the latest data is already inside the shown period', () => {
      // act -- only a transfer lands in October, so the cards are empty but there is nowhere to jump
      arrangeEmpty('2026-10-05');

      // assert & verify
      expect(emptyState()?.querySelector('a')).toBeNull();
    });

    it('should offer no jump to a month the period picker cannot reach', () => {
      // act -- the picker offers five years back from 2026
      arrangeEmpty('2019-03-05');

      // assert & verify
      expect(emptyState()?.querySelector('a')).toBeNull();
    });

    it('should keep the three cards, and skip the lookup, when the period has data', () => {
      // arrange
      setUp(new Date(2026, 10, 11));

      // act
      fixture.detectChanges();

      // assert & verify
      expect(emptyState()).toBeNull();
      expect(fixture.debugElement.queryAll(By.directive(PulseCardComponent)).length).toBe(2);
      expect(mockTransactionApi.getTransactions).not.toHaveBeenCalled();
    });

    it('should still show deltas when only one side of the period is empty', () => {
      // arrange -- income but no spending is a real result, not an empty period
      setUp(new Date(2026, 10, 11));
      mockDashboardApi.getPulse.mockReturnValue(
        of({ ...emptyPulse, currentIncome: 500, previousIncome: 400 }),
      );

      // act
      fixture.detectChanges();

      // assert & verify
      expect(emptyState()).toBeNull();
      expect(fixture.debugElement.queryAll(By.directive(PulseCardComponent)).length).toBe(2);
    });
  });

  describe('period in the URL', () => {
    let harness: RouterTestingHarness;
    let router: Router;

    async function setUpRouted(url: string, now: Date): Promise<void> {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(now);

      mockDashboardApi = {
        getPulse: vi.fn().mockReturnValue(of(mockPulse)),
        getCashFlowTrend: vi.fn().mockReturnValue(of([])),
        getYtdSummary: vi.fn().mockReturnValue(of({})),
        getActionItems: vi.fn().mockReturnValue(of([])),
        getCategoryBreakdown: vi.fn().mockReturnValue(of([])),
        getMerchantBreakdown: vi.fn().mockReturnValue(of(mockMerchants)),
      };
      mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
      mockTransactionApi = { getTransactions: vi.fn().mockReturnValue(latestPage('2026-08-31')) };

      TestBed.configureTestingModule({
        providers: [
          { provide: DashboardApiService, useValue: mockDashboardApi },
          { provide: CategoryApiService, useValue: {} },
          { provide: ToastService, useValue: mockToast },
          { provide: TransactionApiService, useValue: mockTransactionApi },
          provideRouter([{ path: 'dashboard', component: DashboardComponent }]),
        ],
      });
      router = TestBed.inject(Router);
      harness = await RouterTestingHarness.create();
      component = await harness.navigateByUrl(url, DashboardComponent);
      harness.detectChanges();
    }

    it('should open on the preset named in the URL', async () => {
      // act
      await setUpRouted('/dashboard?period=THIS_YEAR', new Date(2026, 5, 15));

      // assert & verify
      expect(component.selectedPreset()).toBe('THIS_YEAR');
      expect(mockDashboardApi.getPulse).toHaveBeenLastCalledWith(
        undefined,
        undefined,
        '2026-01-01',
        '2026-06-15',
      );
    });

    it('should open on a custom month and year from the URL', async () => {
      // act
      await setUpRouted('/dashboard?period=CUSTOM&month=3&year=2022', new Date(2026, 5, 15));

      // assert & verify
      expect(component.selectedPreset()).toBe('CUSTOM');
      expect(component.selectedMonth()).toBe(3);
      expect(component.selectedYear()).toBe(2022);
      expect(mockDashboardApi.getPulse).toHaveBeenLastCalledWith(3, 2022);
    });

    it('should fall back to Last Month for an unusable URL and tidy it', async () => {
      // act
      await setUpRouted('/dashboard?period=NOPE', new Date(2026, 5, 15));

      // assert & verify
      expect(component.selectedPreset()).toBe('LAST_MONTH');
      await vi.waitFor(() => expect(router.url).toBe('/dashboard'));
    });

    it('should write a picked preset to the URL', async () => {
      // arrange
      await setUpRouted('/dashboard', new Date(2026, 5, 15));

      // act
      component.selectedPreset.set('THIS_YEAR');
      harness.detectChanges();

      // assert & verify
      await vi.waitFor(() => expect(router.url).toBe('/dashboard?period=THIS_YEAR'));
    });

    it('should write the month and year for a custom period', async () => {
      // arrange
      await setUpRouted('/dashboard', new Date(2026, 5, 15));

      // act
      component.selectedPreset.set('CUSTOM');
      component.selectedMonth.set(3);
      component.selectedYear.set(2022);
      harness.detectChanges();

      // assert & verify
      await vi.waitFor(() => expect(router.url).toBe('/dashboard?period=CUSTOM&month=3&year=2022'));
    });

    it('should clear the parameter when the default Last Month is picked again', async () => {
      // arrange
      await setUpRouted('/dashboard?period=THIS_YEAR', new Date(2026, 5, 15));

      // act
      component.selectedPreset.set('LAST_MONTH');
      harness.detectChanges();

      // assert & verify
      await vi.waitFor(() => expect(router.url).toBe('/dashboard'));
    });

    it('should follow the URL when it changes, such as the Dashboard nav link', async () => {
      // arrange
      await setUpRouted('/dashboard?period=THIS_YEAR', new Date(2026, 5, 15));
      expect(component.selectedPreset()).toBe('THIS_YEAR');

      // act
      await harness.navigateByUrl('/dashboard');
      harness.detectChanges();

      // assert & verify
      expect(component.selectedPreset()).toBe('LAST_MONTH');
    });
  });

  describe('drill-down links', () => {
    function cards(): PulseCardComponent[] {
      return fixture.debugElement
        .queryAll(By.directive(PulseCardComponent))
        .map((c) => c.componentInstance as PulseCardComponent);
    }

    it('should link Income and Expenses to their transactions for a preset period', () => {
      // arrange -- June 15, 2026, so LAST_MONTH is May
      setUp(new Date(2026, 5, 15));
      fixture.detectChanges();

      // act
      component.selectedPreset.set('LAST_MONTH');
      fixture.detectChanges();

      // assert & verify
      expect(cards()[0].link()).toEqual({
        type: 'INCOME',
        startDate: '2026-05-01',
        endDate: '2026-05-31',
      });
      expect(cards()[1].link()).toEqual({
        type: 'EXPENSE',
        startDate: '2026-05-01',
        endDate: '2026-05-31',
      });
    });

    it('should use the whole picked month for a custom period', () => {
      // arrange
      setUp(new Date(2026, 5, 15));
      fixture.detectChanges();

      // act
      component.selectedPreset.set('CUSTOM');
      component.selectedMonth.set(3);
      component.selectedYear.set(2022);
      fixture.detectChanges();

      // assert & verify
      expect(cards()[1].link()).toEqual({
        type: 'EXPENSE',
        startDate: '2022-03-01',
        endDate: '2022-03-31',
      });
    });

    it("should link each merchant row to that merchant's expenses for the period", () => {
      // arrange
      setUp(new Date(2026, 5, 15));
      fixture.detectChanges();
      component.selectedPreset.set('LAST_MONTH');
      fixture.detectChanges();

      // act
      const anchor: HTMLAnchorElement = fixture.nativeElement.querySelector(
        '[data-testid="merchant-row"] a',
      );

      // assert & verify -- merchants are ranked by total, so Merchant 7 leads
      expect(anchor.getAttribute('href')).toBe(
        '/transactions?type=EXPENSE&startDate=2026-05-01&endDate=2026-05-31&merchant=Merchant%207',
      );
      expect(anchor.getAttribute('aria-label')).toBe('Merchant 7: view transactions');
    });
  });

  // PF-864: the full subtitle for each preset, at a fixed clock. A preset is compared with the
  // immediately preceding window of the same number of days (DashboardService.getPulse), so these
  // strings are not "the previous month/year". The clock is local midday, and the strings depend
  // on periodRange() being local calendar days (PF-861), so run under TZ=UTC,
  // TZ=America/New_York and TZ=Europe/Helsinki.
  describe('ytd year follows the period', () => {
    function lastYtdYear(): number {
      const calls = mockDashboardApi.getYtdSummary.mock.calls;
      return calls[calls.length - 1][0] as number;
    }

    it('should ask for last year when the LAST_YEAR preset is selected', () => {
      // arrange -- June 15, 2026
      setUp(new Date(2026, 5, 15));
      fixture.detectChanges();

      // act
      component.selectedPreset.set('LAST_YEAR');
      fixture.detectChanges();

      // assert & verify
      expect(lastYtdYear()).toBe(2025);
    });

    it('should label the ytd card with last year even when the api returns no data', () => {
      // arrange
      setUp(new Date(2026, 5, 15));
      fixture.detectChanges();

      // act
      component.selectedPreset.set('LAST_YEAR');
      fixture.detectChanges();

      // assert & verify
      const ytdSummary = fixture.debugElement.query(By.directive(YtdSummaryComponent))
        .componentInstance as YtdSummaryComponent;
      expect(ytdSummary.year()).toBe(2025);
    });

    it('should ask for the current year for THIS_YEAR, THIS_MONTH and LAST_MONTH mid-year', () => {
      // arrange
      setUp(new Date(2026, 5, 15));
      fixture.detectChanges();

      for (const preset of ['THIS_YEAR', 'THIS_MONTH', 'LAST_MONTH'] as const) {
        // act
        component.selectedPreset.set(preset);
        fixture.detectChanges();

        // assert & verify
        expect(lastYtdYear()).toBe(2026);
      }
    });

    it('should ask for the previous year when LAST_MONTH is December of that year', () => {
      // arrange -- January 10, 2026, so last month is December 2025
      setUp(new Date(2026, 0, 10));
      fixture.detectChanges();

      // act
      component.selectedPreset.set('LAST_MONTH');
      fixture.detectChanges();

      // assert & verify
      expect(lastYtdYear()).toBe(2025);
    });

    it('should use the picked year for a custom month', () => {
      // arrange
      setUp(new Date(2026, 5, 15));
      fixture.detectChanges();

      // act
      component.selectedPreset.set('CUSTOM');
      component.selectedMonth.set(3);
      component.selectedYear.set(2024);
      fixture.detectChanges();

      // assert & verify
      expect(lastYtdYear()).toBe(2024);
    });
  });

  describe('concurrent loads', () => {
    it('should keep the latest period results when an older request finishes last', () => {
      // arrange -- the first load hangs, a later load answers immediately
      setUp(new Date(2026, 5, 15));
      const slowPulse = new Subject<DashboardPulse>();
      mockDashboardApi.getPulse.mockReturnValueOnce(slowPulse);
      fixture.detectChanges();

      // act -- switch period (fast response), then the stale response arrives
      mockDashboardApi.getPulse.mockReturnValue(of({ ...mockPulse, currentIncome: 777 }));
      component.selectedPreset.set('THIS_YEAR');
      fixture.detectChanges();
      slowPulse.next({ ...mockPulse, currentIncome: 111 });
      slowPulse.complete();
      fixture.detectChanges();

      // assert & verify
      expect(component.pulse()?.currentIncome).toBe(777);
    });

    it('should clear the loading flag once the latest load completes', () => {
      // arrange
      setUp(new Date(2026, 5, 15));
      const slowPulse = new Subject<DashboardPulse>();
      mockDashboardApi.getPulse.mockReturnValueOnce(slowPulse);
      fixture.detectChanges();

      // act
      mockDashboardApi.getPulse.mockReturnValue(of(mockPulse));
      component.selectedPreset.set('THIS_YEAR');
      fixture.detectChanges();

      // assert & verify
      expect(component.loading()).toBe(false);
    });
  });

  describe('periodSubtitle per preset (PF-864)', () => {
    beforeEach(() => {
      setUp(new Date(2026, 9, 17, 12, 0)); // Oct 17, 2026
      fixture.detectChanges();
    });

    const subtitleOnPage = (): string | undefined =>
      fixture.nativeElement.querySelector('[data-testid="period-subtitle"]')?.textContent?.trim();

    it('should read THIS_MONTH against the 17 days before it', () => {
      // act
      component.selectedPreset.set('THIS_MONTH');
      fixture.detectChanges();

      // assert & verify
      const expected =
        'Oct 1 to Oct 17, 2026 compared with the 17 days before (Sep 14 to Sep 30, 2026)';
      expect(component.periodSubtitle()).toBe(expected);
      expect(subtitleOnPage()).toBe(expected);
    });

    it('should read LAST_MONTH as the month name against the 30 days before it', () => {
      // act
      component.selectedPreset.set('LAST_MONTH');
      fixture.detectChanges();

      // assert & verify
      const expected = 'September 2026 compared with the 30 days before (Aug 2 to Aug 31, 2026)';
      expect(component.periodSubtitle()).toBe(expected);
      expect(subtitleOnPage()).toBe(expected);
    });

    it('should read THIS_YEAR against the same dates last year', () => {
      // act
      component.selectedPreset.set('THIS_YEAR');
      fixture.detectChanges();

      // assert & verify
      const expected = 'Jan 1 to Oct 17, 2026 compared with Jan 1 to Oct 17, 2025';
      expect(component.periodSubtitle()).toBe(expected);
      expect(subtitleOnPage()).toBe(expected);
    });

    it('should read LAST_YEAR against the whole year before it', () => {
      // act
      component.selectedPreset.set('LAST_YEAR');
      fixture.detectChanges();

      // assert & verify
      const expected = 'Jan 1 to Dec 31, 2025 compared with Jan 1 to Dec 31, 2024';
      expect(component.periodSubtitle()).toBe(expected);
      expect(subtitleOnPage()).toBe(expected);
    });
  });

  describe('periodSubtitle', () => {
    it('should compare a custom month with the previous calendar month', () => {
      // arrange
      setUp(new Date(2026, 9, 13));
      fixture.detectChanges();

      // act
      component.selectedPreset.set('CUSTOM');
      component.selectedMonth.set(3);
      component.selectedYear.set(2026);

      // assert & verify
      expect(component.periodSubtitle()).toBe('March 2026 compared with February 2026');
    });

    it('should wrap a custom January back to the prior December', () => {
      // arrange
      setUp(new Date(2026, 9, 13));
      fixture.detectChanges();

      // act
      component.selectedPreset.set('CUSTOM');
      component.selectedMonth.set(1);
      component.selectedYear.set(2026);

      // assert & verify
      expect(component.periodSubtitle()).toBe('January 2026 compared with December 2025');
    });

    it('should say what a preset range is compared with', () => {
      // arrange
      setUp(new Date(2026, 9, 13));

      // act
      fixture.detectChanges();

      // assert & verify -- default preset is LAST_MONTH
      expect(component.periodSubtitle()).toContain(' compared with ');
      expect(
        fixture.nativeElement.querySelector('[data-testid="period-subtitle"]').textContent,
      ).toContain(' compared with ');
    });
  });

  describe('review banner', () => {
    it('should not render when there is nothing to review', () => {
      // arrange
      setUp(new Date(2026, 9, 13));

      // act
      fixture.detectChanges();

      // assert & verify
      expect(fixture.nativeElement.querySelector('app-review-banner section')).toBeNull();
    });

    it('should pass action items to the banner and render an entry for each', () => {
      // arrange
      setUp(new Date(2026, 9, 13));
      mockDashboardApi.getActionItems.mockReturnValue(
        of([{ type: ActionType.UNCATEGORIZED, count: 7, message: 'x', route: '/transactions' }]),
      );

      // act
      fixture.detectChanges();

      // assert & verify
      const banner = fixture.debugElement.query(By.directive(ReviewBannerComponent))
        .componentInstance as ReviewBannerComponent;
      expect(banner.items().length).toBe(1);
      expect(
        fixture.nativeElement.querySelector('app-review-banner button').textContent.trim(),
      ).toBe('7 uncategorized expenses');
    });
  });

  describe('top merchants', () => {
    it('should show the transaction count with correct singular and plural wording', () => {
      // arrange
      setUp(new Date(2026, 9, 13));
      mockDashboardApi.getMerchantBreakdown.mockReturnValue(
        of([
          {
            representativeMerchantId: 1,
            displayName: 'Solo Cafe',
            total: 4.5,
            transactionCount: 1,
          },
          { representativeMerchantId: 2, displayName: 'Busy Mart', total: 90, transactionCount: 6 },
        ]),
      );

      // act
      fixture.detectChanges();

      // assert & verify
      const rows: HTMLElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('[data-testid="merchant-row"]'),
      );
      // ranked by total, so Busy Mart ($90) comes before Solo Cafe ($4.50)
      expect(rows[0].textContent).toContain('Busy Mart');
      expect(rows[0].textContent).toContain('6 transactions');
      expect(rows[1].textContent).toContain('Solo Cafe');
      expect(rows[1].textContent).toContain('1 transaction');
      expect(rows[1].textContent).not.toContain('1 transactions');
    });
  });

  describe('empty period', () => {
    it('should show empty states and no banner when the period has no data', () => {
      // arrange
      setUp(new Date(2026, 9, 13));
      mockDashboardApi.getPulse.mockReturnValue(
        of({
          currentIncome: 0,
          previousIncome: 0,
          currentExpense: 0,
          previousExpense: 0,
          currentSavingsRate: 0,
          previousSavingsRate: 0,
        }),
      );
      mockDashboardApi.getMerchantBreakdown.mockReturnValue(of([]));

      // act
      fixture.detectChanges();

      // assert & verify
      expect(
        fixture.nativeElement.querySelector('[data-testid="merchants-empty"]').textContent,
      ).toContain('No spending recorded for this period.');
      expect(fixture.nativeElement.querySelector('app-review-banner section')).toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain('NaN');
    });
  });

  describe('loading state', () => {
    it('should show skeleton placeholders, not a spinner, while loading', () => {
      // arrange
      setUp(new Date(2026, 9, 13));
      fixture.detectChanges();

      // act
      component.loading.set(true);
      fixture.detectChanges();

      // assert & verify
      expect(
        fixture.nativeElement.querySelector('[data-testid="dashboard-skeleton"]'),
      ).not.toBeNull();
      expect(fixture.nativeElement.querySelector('p-progressspinner')).toBeNull();
      const skeleton = fixture.nativeElement.querySelector('[data-testid="dashboard-skeleton"]');
      expect(skeleton.getAttribute('role')).toBe('status');
      expect(skeleton.textContent).toContain('Loading dashboard');
    });
  });
});
