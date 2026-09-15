import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { ReportsComponent } from './reports.component';
import { CategoryReportComponent } from './components/category-report/category-report.component';
import { MerchantReportComponent } from './components/merchant-report/merchant-report.component';
import { IncomeExpenseReportComponent } from './components/income-expense-report/income-expense-report.component';
import { NetWorthReportComponent } from './components/net-worth-report/net-worth-report.component';
import { ReportApiService } from './services/report-api.service';

describe('ReportsComponent', () => {
  let fixture: ComponentFixture<ReportsComponent>;
  let component: ReportsComponent;
  let mockRouter: any;
  let mockActivatedRoute: any;
  let mockReportApi: any;

  // p-tabs' TabList calls ngAfterViewInit -> bindResizeObserver(), which JSDOM doesn't implement.
  beforeAll(() => {
    (globalThis as any).ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
  });

  beforeEach(async () => {
    mockRouter = { navigate: vi.fn() };
    mockActivatedRoute = {
      snapshot: { queryParams: {} },
      queryParams: of({}),
    };
    mockReportApi = {
      getNetWorth: vi.fn().mockReturnValue(of([])),
      getCategoryBreakdown: vi.fn().mockReturnValue(of([])),
      getMerchantBreakdown: vi.fn().mockReturnValue(of([])),
      getMonthlyBreakdown: vi.fn().mockReturnValue(of([])),
    };

    await TestBed.configureTestingModule({
      imports: [ReportsComponent],
      providers: [
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: ReportApiService, useValue: mockReportApi },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReportsComponent);
    component = fixture.componentInstance;
  });

  it('should default to the Category tab (index 0)', () => {
    // act
    fixture.detectChanges();

    // assert & verify
    expect(component.activeTabIndex()).toBe(0);
  });

  it('should default the date range to "Last 3 Months"', () => {
    // act
    fixture.detectChanges();

    // assert & verify
    expect(component.dateRange().label).toBe('Last 3 Months');
  });

  it('should sync the date range to the URL on load', () => {
    // act
    fixture.detectChanges();

    // assert & verify
    expect(mockRouter.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: expect.objectContaining({ label: 'Last 3 Months' }),
        queryParamsHandling: 'replace',
      }),
    );
  });

  it('should re-sync the URL when the date range changes', () => {
    // act
    fixture.detectChanges();
    mockRouter.navigate.mockClear();
    component.dateRange.set({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      label: 'Custom Range',
    });
    fixture.detectChanges();

    // assert & verify
    expect(mockRouter.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { startDate: '2026-01-01', endDate: '2026-01-31', label: 'Custom Range' },
        queryParamsHandling: 'replace',
      }),
    );
  });

  it('should pass the current date range down to every sub-report', () => {
    // act
    fixture.detectChanges();

    // assert & verify
    const category = fixture.debugElement.query(By.directive(CategoryReportComponent))
      .componentInstance as CategoryReportComponent;
    const merchant = fixture.debugElement.query(By.directive(MerchantReportComponent))
      .componentInstance as MerchantReportComponent;
    const incomeExpense = fixture.debugElement.query(By.directive(IncomeExpenseReportComponent))
      .componentInstance as IncomeExpenseReportComponent;
    const netWorth = fixture.debugElement.query(By.directive(NetWorthReportComponent))
      .componentInstance as NetWorthReportComponent;

    expect(category.dateRange()).toEqual(component.dateRange());
    expect(merchant.dateRange()).toEqual(component.dateRange());
    expect(incomeExpense.dateRange()).toEqual(component.dateRange());
    expect(netWorth.dateRange()).toEqual(component.dateRange());
  });

  it('should switch the active tab when selected', () => {
    // act
    fixture.detectChanges();
    component.activeTabIndex.set(1);
    fixture.detectChanges();

    // assert & verify
    expect(component.activeTabIndex()).toBe(1);
  });
});
