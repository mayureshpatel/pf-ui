import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { MerchantReportComponent } from './merchant-report.component';
import { ReportApiService } from '../../services/report-api.service';
import { Merchant } from '@models/merchant.model';
import { DateRange, MerchantReportData } from '../../models/reports.model';

describe('MerchantReportComponent', () => {
  let component: MerchantReportComponent;
  let fixture: ComponentFixture<MerchantReportComponent>;
  let mockReportApi: any;

  const merchant = (id: number, cleanName: string): Merchant => ({
    id,
    userId: 1,
    originalName: cleanName,
    cleanName,
  });

  const row = (
    m: Merchant,
    total: number,
    count: number,
    categories: string[],
  ): MerchantReportData => ({
    merchant: m,
    total,
    count,
    categories,
  });

  const target = merchant(1, 'Target');
  const amazon = merchant(2, 'Amazon');

  const mockMerchantData: MerchantReportData[] = [
    row(target, 340, 2, ['Shopping', 'Groceries']),
    row(amazon, 60, 1, ['Shopping']),
  ];

  const mockDateRange: DateRange = {
    startDate: '2026-06-01',
    endDate: '2026-09-01',
    label: 'Last 3 Months',
  };

  const setData = (data: MerchantReportData[]): void => {
    mockReportApi.getMerchantBreakdown.mockReturnValue(of(data));
    fixture.componentRef.setInput('dateRange', mockDateRange);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    mockReportApi = {
      getMerchantBreakdown: vi.fn().mockReturnValue(of([])),
    };

    await TestBed.configureTestingModule({
      imports: [MerchantReportComponent],
      providers: [{ provide: ReportApiService, useValue: mockReportApi }],
    }).compileComponents();

    fixture = TestBed.createComponent(MerchantReportComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    setData(mockMerchantData);

    expect(component).toBeTruthy();
  });

  it('should load the merchant breakdown for the given date range on init', () => {
    setData(mockMerchantData);

    expect(mockReportApi.getMerchantBreakdown).toHaveBeenCalledWith('2026-06-01', '2026-09-01');
    expect(component.merchantData()).toEqual(mockMerchantData);
  });

  it('should reload when the date range input changes', () => {
    setData(mockMerchantData);
    mockReportApi.getMerchantBreakdown.mockClear();

    fixture.componentRef.setInput('dateRange', {
      startDate: '2026-09-02',
      endDate: '2026-09-30',
      label: 'Custom Range',
    });
    fixture.detectChanges();

    expect(mockReportApi.getMerchantBreakdown).toHaveBeenCalledWith('2026-09-02', '2026-09-30');
  });

  it('should set loadError and stop loading when the request fails', () => {
    mockReportApi.getMerchantBreakdown.mockReturnValue(
      throwError(() => new Error('network error')),
    );
    fixture.componentRef.setInput('dateRange', mockDateRange);
    fixture.detectChanges();

    expect(component.loadError()).toBe(true);
    expect(component.loading()).toBe(false);
  });

  describe('hasData', () => {
    it('should be false when there are no merchant entries', () => {
      setData([]);

      expect(component.hasData()).toBe(false);
    });

    it('should be true when at least one merchant entry is present', () => {
      setData(mockMerchantData);

      expect(component.hasData()).toBe(true);
    });
  });

  describe('barChartData', () => {
    it("should label each bar with the merchant's clean name and chart its total", () => {
      // arrange & act
      setData(mockMerchantData);

      // assert & verify
      expect(component.barChartData().labels).toEqual(['Target', 'Amazon']);
      expect(component.barChartData().datasets[0].data).toEqual([340, 60]);
    });

    it('should cap displayed merchants to the top 10 by spend', () => {
      // arrange -- 12 distinct merchants, descending totals
      const many: MerchantReportData[] = Array.from({ length: 12 }, (_, i): MerchantReportData =>
        row(merchant(i, `Merchant ${i}`), 1000 - i * 10, 1, []),
      );

      // act
      setData(many);

      // assert & verify
      expect(component.barChartData().labels).toHaveLength(10);
      expect(component.barChartData().labels).not.toContain('Merchant 10');
      expect(component.barChartData().labels).not.toContain('Merchant 11');
    });

    it('should assign each bar a deterministic hue-rotated color', () => {
      // arrange & act
      setData(mockMerchantData);

      // assert & verify -- hsl(i * 36 % 360, 70%, 60%)
      expect(component.barChartData().datasets[0].backgroundColor).toEqual([
        'hsl(0, 70%, 60%)',
        'hsl(36, 70%, 60%)',
      ]);
    });

    it("should fall back to 'Unknown' when a merchant has no clean name", () => {
      // arrange & act
      setData([row(merchant(9, ''), 25, 1, [])]);

      // assert & verify
      expect(component.barChartData().labels).toEqual(['Unknown']);
    });
  });

  describe('doughnutChartData', () => {
    it('should cap displayed merchants to the top 5 by spend regardless of bar-chart data', () => {
      // arrange
      const many: MerchantReportData[] = Array.from({ length: 8 }, (_, i): MerchantReportData =>
        row(merchant(i, `Merchant ${i}`), 1000 - i * 10, 1, []),
      );

      // act
      setData(many);

      // assert & verify
      expect(component.doughnutChartData().labels).toHaveLength(5);
      expect(component.barChartData().labels).toHaveLength(8);
    });
  });

  describe('rendering', () => {
    it('should render both charts when data is present', () => {
      // arrange & act
      setData(mockMerchantData);
      const charts = fixture.debugElement.queryAll((de: any): boolean => de.name === 'p-chart');

      // assert & verify
      expect(charts).toHaveLength(2);
      expect(charts[0].componentInstance.type).toBe('bar');
      expect(charts[1].componentInstance.type).toBe('doughnut');
      expect(fixture.nativeElement.textContent).not.toContain('No merchant activity');
      expect(fixture.nativeElement.textContent).not.toContain('No distribution data');
    });

    it('should render empty-state placeholders instead of charts when there is no data', () => {
      // arrange & act
      setData([]);
      const charts = fixture.debugElement.queryAll((de: any): boolean => de.name === 'p-chart');

      // assert & verify
      expect(charts).toHaveLength(0);
      expect(fixture.nativeElement.textContent).toContain('No merchant activity');
      expect(fixture.nativeElement.textContent).toContain('No distribution data');
    });

    it('should render one details-table row per merchant with formatted currency and category chips', () => {
      // arrange & act
      setData(mockMerchantData);
      const rows = fixture.nativeElement.querySelectorAll('tbody tr');

      // assert & verify
      expect(rows).toHaveLength(2);
      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('Target');
      expect(text).toContain('$340.00');
      expect(text).toContain('Amazon');
      expect(text).toContain('$60.00');
      expect(text).toContain('Shopping');
      expect(text).toContain('Groceries');
    });

    it("should fall back through cleanName -> originalName -> 'Unknown Merchant' in the table", () => {
      // arrange & act -- cleanName blank, originalName present
      const blankClean: Merchant = {
        id: 3,
        userId: 1,
        originalName: 'RAW MERCHANT NAME',
        cleanName: '',
      };
      setData([row(blankClean, 15, 1, [])]);

      // assert & verify
      expect(fixture.nativeElement.textContent).toContain('RAW MERCHANT NAME');
    });
  });
});
