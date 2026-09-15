import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { IncomeExpenseReportComponent } from './income-expense-report.component';
import { ReportApiService } from '../../services/report-api.service';
import { DateRange, MonthlyReportData } from '../../models/reports.model';

describe('IncomeExpenseReportComponent', () => {
  let component: IncomeExpenseReportComponent;
  let fixture: ComponentFixture<IncomeExpenseReportComponent>;
  let mockReportApi: any;

  const mockMonthlyData: MonthlyReportData[] = [
    { month: '2026-01', income: 4000, expense: 2500, netSavings: 1500 },
    { month: '2026-02', income: 4200, expense: 4800, netSavings: -600 },
  ];

  const mockDateRange: DateRange = {
    startDate: '2026-01-01',
    endDate: '2026-02-28',
    label: 'Last 3 Months',
  };

  const setData = (data: MonthlyReportData[]): void => {
    mockReportApi.getMonthlyBreakdown.mockReturnValue(of(data));
    fixture.componentRef.setInput('dateRange', mockDateRange);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    mockReportApi = {
      getMonthlyBreakdown: vi.fn().mockReturnValue(of([])),
    };

    await TestBed.configureTestingModule({
      imports: [IncomeExpenseReportComponent],
      providers: [{ provide: ReportApiService, useValue: mockReportApi }],
    }).compileComponents();

    fixture = TestBed.createComponent(IncomeExpenseReportComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    setData(mockMonthlyData);

    expect(component).toBeTruthy();
  });

  it('should load the monthly breakdown for the given date range on init', () => {
    setData(mockMonthlyData);

    expect(mockReportApi.getMonthlyBreakdown).toHaveBeenCalledWith('2026-01-01', '2026-02-28');
    expect(component.monthlyData()).toEqual(mockMonthlyData);
  });

  it('should reload when the date range input changes', () => {
    setData(mockMonthlyData);
    mockReportApi.getMonthlyBreakdown.mockClear();

    fixture.componentRef.setInput('dateRange', { startDate: '2026-03-01', endDate: '2026-03-31', label: 'Custom Range' });
    fixture.detectChanges();

    expect(mockReportApi.getMonthlyBreakdown).toHaveBeenCalledWith('2026-03-01', '2026-03-31');
  });

  it('should set loadError and stop loading when the request fails', () => {
    mockReportApi.getMonthlyBreakdown.mockReturnValue(throwError(() => new Error('network error')));
    fixture.componentRef.setInput('dateRange', mockDateRange);
    fixture.detectChanges();

    expect(component.loadError()).toBe(true);
    expect(component.loading()).toBe(false);
  });

  describe('hasData', () => {
    it('should be false when there are no monthly entries', () => {
      setData([]);

      expect(component.hasData()).toBe(false);
    });

    it('should be true when at least one month is present', () => {
      setData(mockMonthlyData);

      expect(component.hasData()).toBe(true);
    });
  });

  describe('stackedBarData', () => {
    it('should label each point with a "MMM YY" month label, chronologically ordered', () => {
      // arrange & act
      setData(mockMonthlyData);

      // assert & verify
      expect(component.stackedBarData().labels).toEqual(['Jan 26', 'Feb 26']);
    });

    it('should chart raw income and absolute-valued expense as separate datasets', () => {
      // arrange & act
      setData(mockMonthlyData);
      const [income, expense] = component.stackedBarData().datasets;

      // assert & verify
      expect(income).toMatchObject({ label: 'Income', data: [4000, 4200] });
      expect(expense).toMatchObject({ label: 'Expenses', data: [2500, 4800] });
    });
  });

  describe('lineChartData', () => {
    it('should chart net savings (income minus expense) per month, including negative months', () => {
      // arrange & act
      setData(mockMonthlyData);

      // assert & verify
      expect(component.lineChartData().labels).toEqual(['Jan 26', 'Feb 26']);
      expect(component.lineChartData().datasets[0]).toMatchObject({
        label: 'Net Savings',
        data: [1500, -600],
      });
    });
  });

  describe('getSavingsClass', () => {
    it('should style non-negative net savings as emerald', () => {
      expect(component.getSavingsClass(1500)).toContain('text-emerald-600');
      expect(component.getSavingsClass(0)).toContain('text-emerald-600');
    });

    it('should style negative net savings as rose', () => {
      expect(component.getSavingsClass(-600)).toContain('text-rose-600');
    });
  });

  describe('rendering', () => {
    it('should render both charts when data is present', () => {
      // arrange & act
      setData(mockMonthlyData);
      const charts = fixture.debugElement.queryAll((de: any): boolean => de.name === 'p-chart');

      // assert & verify
      expect(charts).toHaveLength(2);
      expect(charts[0].componentInstance.type).toBe('bar');
      expect(charts[1].componentInstance.type).toBe('line');
      expect(fixture.nativeElement.textContent).not.toContain('No activity data');
      expect(fixture.nativeElement.textContent).not.toContain('No savings data');
    });

    it('should render empty-state placeholders instead of charts when there is no data', () => {
      // arrange & act
      setData([]);
      const charts = fixture.debugElement.queryAll((de: any): boolean => de.name === 'p-chart');

      // assert & verify
      expect(charts).toHaveLength(0);
      expect(fixture.nativeElement.textContent).toContain('No activity data');
      expect(fixture.nativeElement.textContent).toContain('No savings data');
    });

    it('should render one summary-table row per aggregated month with formatted currency', () => {
      // arrange & act
      setData(mockMonthlyData);
      const rows = fixture.nativeElement.querySelectorAll('tbody tr');

      // assert & verify
      expect(rows).toHaveLength(2);
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('2026-01');
      expect(text).toContain('$4,000.00');
      expect(text).toContain('$2,500.00');
      expect(text).toContain('$1,500.00');
      expect(text).toContain('-$600.00');
    });
  });
});
