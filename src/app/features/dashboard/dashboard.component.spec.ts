import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { DashboardApiService } from './services/dashboard-api.service';
import { CategoryApiService } from '@features/categories/services/category-api.service';
import { ToastService } from '@core/services/toast.service';
import { DashboardPulse } from '@models/dashboard.model';
import { PulseCardComponent } from './components/pulse-card/pulse-card.component';
import { YtdSummaryComponent } from './components/ytd-summary/ytd-summary.component';

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let mockDashboardApi: any;
  let mockToast: any;

  const mockPulse: DashboardPulse = {
    currentIncome: 1000,
    previousIncome: 900,
    currentExpense: 500,
    previousExpense: 450,
    currentSavingsRate: 50,
    previousSavingsRate: 50,
  };
  const mockMerchants = [1, 2, 3, 4, 5, 6, 7].map((id) => ({
    merchant: { id, cleanName: `Merchant ${id}`, originalName: `Merchant ${id}` },
    total: id * 10,
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

    it('should pass loaded pulse data down to the pulse cards', () => {
      // act
      fixture.detectChanges();

      // assert & verify
      const cards = fixture.debugElement.queryAll(By.directive(PulseCardComponent));
      const income = cards[0].componentInstance as PulseCardComponent;
      expect(income.value()).toBe(1000);
      expect(income.previousValue()).toBe(900);

      const expense = cards[1].componentInstance as PulseCardComponent;
      expect(expense.value()).toBe(500);
      expect(expense.previousValue()).toBe(450);

      const savings = cards[2].componentInstance as PulseCardComponent;
      expect(savings.value()).toBe(50);
      expect(savings.type()).toBe('percent');
    });

    it('should pass loaded ytd data down to the ytd summary widget', () => {
      // arrange
      mockDashboardApi.getYtdSummary.mockReturnValue(
        of({
          year: 2026,
          totalIncome: 12000,
          totalExpense: 8000,
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

  describe('getSavingsRateColor', () => {
    beforeEach(() => setUp(new Date(2026, 5, 15)));

    it('should return a neutral color for an undefined or zero rate', () => {
      // assert & verify
      expect(component.getSavingsRateColor(undefined)).toBe('text-surface-500');
      expect(component.getSavingsRateColor(0)).toBe('text-surface-500');
    });

    it('should return a positive color for a positive rate', () => {
      // assert & verify
      expect(component.getSavingsRateColor(15)).toBe('text-emerald-600');
    });

    it('should return a negative color for a negative rate', () => {
      // assert & verify
      expect(component.getSavingsRateColor(-15)).toBe('text-rose-600');
    });
  });
});
