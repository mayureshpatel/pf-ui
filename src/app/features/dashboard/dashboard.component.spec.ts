import { vi, Mocked } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { DashboardApiService } from './services/dashboard-api.service';
import { CategoryApiService } from '@features/categories/services/category-api.service';
import { ToastService } from '@core/services/toast.service';
import { ActionType, DashboardPulse } from '@models/dashboard.model';
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

    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: DashboardApiService, useValue: mockDashboardApi },
        { provide: CategoryApiService, useValue: {} },
        { provide: ToastService, useValue: mockToast },
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

  // PF-864: the full subtitle for each preset, at a fixed clock. A preset is compared with the
  // immediately preceding window of the same number of days (DashboardService.getPulse), so these
  // strings are not "the previous month/year". The clock is local midday, and the strings depend
  // on periodRange() being local calendar days (PF-861), so run under TZ=UTC,
  // TZ=America/New_York and TZ=Europe/Helsinki.
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
      const expected = 'Oct 1 to Oct 17, 2026 compared with Sep 14 to Sep 30, 2026';
      expect(component.periodSubtitle()).toBe(expected);
      expect(subtitleOnPage()).toBe(expected);
    });

    it('should read LAST_MONTH as the month name against the 30 days before it', () => {
      // act
      component.selectedPreset.set('LAST_MONTH');
      fixture.detectChanges();

      // assert & verify
      const expected = 'September 2026 compared with Aug 2 to Aug 31, 2026';
      expect(component.periodSubtitle()).toBe(expected);
      expect(subtitleOnPage()).toBe(expected);
    });

    it('should read THIS_YEAR against the 290 days before it', () => {
      // act
      component.selectedPreset.set('THIS_YEAR');
      fixture.detectChanges();

      // assert & verify -- Jan 1 to Oct 17 is 290 days, so the window ends Dec 31, 2025 and
      // starts Mar 17, 2025
      const expected = 'Jan 1 to Oct 17, 2026 compared with Mar 17 to Dec 31, 2025';
      expect(component.periodSubtitle()).toBe(expected);
      expect(subtitleOnPage()).toBe(expected);
    });

    it('should read LAST_YEAR against the 365 days before it', () => {
      // act
      component.selectedPreset.set('LAST_YEAR');
      fixture.detectChanges();

      // assert & verify -- 2024 is a leap year, so 365 days before Jan 1, 2025 is Jan 2, 2024
      const expected = 'Jan 1 to Dec 31, 2025 compared with Jan 2 to Dec 31, 2024';
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
