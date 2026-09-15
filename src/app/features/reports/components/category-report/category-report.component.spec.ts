import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CategoryReportComponent } from './category-report.component';
import { ReportApiService } from '../../services/report-api.service';
import { Category, CategoryType } from '@models/category.model';
import { CategoryReportData, DateRange } from '../../models/reports.model';
import { getCategoryColor } from '@shared/utils/category.utils';

describe('CategoryReportComponent', () => {
  let component: CategoryReportComponent;
  let fixture: ComponentFixture<CategoryReportComponent>;
  let mockReportApi: any;

  const category = (id: number, name: string, color: string): Category =>
    ({
      id,
      userId: 1,
      name,
      type: CategoryType.EXPENSE,
      parent: null,
      icon: 'pi-tag',
      color,
    }) as Category;

  const rent = category(1, 'Rent', '#3B82F6');
  const dining = category(2, 'Dining Out', '');

  const mockCategoryData: CategoryReportData[] = [
    { category: rent, total: 900, count: 1, avgTransaction: 900 },
    { category: dining, total: 120, count: 1, avgTransaction: 120 },
  ];

  const mockDateRange: DateRange = {
    startDate: '2026-06-01',
    endDate: '2026-09-01',
    label: 'Last 3 Months',
  };

  const setDateRange = (range: DateRange = mockDateRange): void => {
    fixture.componentRef.setInput('dateRange', range);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    mockReportApi = {
      getCategoryBreakdown: vi.fn().mockReturnValue(of(mockCategoryData)),
    };

    await TestBed.configureTestingModule({
      imports: [CategoryReportComponent],
      providers: [{ provide: ReportApiService, useValue: mockReportApi }],
    }).compileComponents();

    fixture = TestBed.createComponent(CategoryReportComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    setDateRange();

    expect(component).toBeTruthy();
  });

  it('should load the category breakdown for the given date range on init', () => {
    setDateRange();

    expect(mockReportApi.getCategoryBreakdown).toHaveBeenCalledWith('2026-06-01', '2026-09-01');
    expect(component.categoryData()).toEqual(mockCategoryData);
  });

  it('should reload when the date range input changes', () => {
    setDateRange();
    mockReportApi.getCategoryBreakdown.mockClear();

    setDateRange({ startDate: '2026-09-02', endDate: '2026-09-30', label: 'Custom Range' });

    expect(mockReportApi.getCategoryBreakdown).toHaveBeenCalledWith('2026-09-02', '2026-09-30');
  });

  it('should set loadError and stop loading when the request fails', () => {
    mockReportApi.getCategoryBreakdown.mockReturnValue(
      throwError(() => new Error('network error')),
    );

    setDateRange();

    expect(component.loadError()).toBe(true);
    expect(component.loading()).toBe(false);
  });

  it('should clear a prior loadError once a retry succeeds', () => {
    mockReportApi.getCategoryBreakdown.mockReturnValue(
      throwError(() => new Error('network error')),
    );
    setDateRange();
    expect(component.loadError()).toBe(true);

    mockReportApi.getCategoryBreakdown.mockReturnValue(of(mockCategoryData));
    component.loadCategoryData();

    expect(component.loadError()).toBe(false);
    expect(component.categoryData()).toEqual(mockCategoryData);
  });

  describe('bar color', () => {
    it("should use the category's own color directly when one is set", () => {
      // arrange & act
      setDateRange();
      const rentIndex = component
        .categoryData()
        .findIndex((c): boolean => c.category.name === 'Rent');

      // assert & verify
      expect(component.chartData().datasets[0].backgroundColor[rentIndex]).toBe('#3B82F6');
      expect(component.chartData().datasets[0].hoverBackgroundColor[rentIndex]).toBe('#3B82F6');
    });

    it('should fall back to a name-derived color when the category has no color set', () => {
      // arrange & act
      setDateRange();
      const diningIndex = component
        .categoryData()
        .findIndex((c): boolean => c.category.name === 'Dining Out');

      // assert & verify
      const expected = getCategoryColor('Dining Out');
      expect(component.chartData().datasets[0].backgroundColor[diningIndex]).toBe(expected);
      expect(component.chartData().datasets[0].hoverBackgroundColor[diningIndex]).toBe(expected);
    });
  });

  describe('csvRows', () => {
    it('builds a header row plus one row per category with the real aggregated totals', () => {
      setDateRange();

      expect(component.csvRows()).toEqual([
        ['Category', 'Total', 'Transaction Count', 'Avg / Txn'],
        ['Rent', '900.00', '1', '900.00'],
        ['Dining Out', '120.00', '1', '120.00'],
      ]);
    });
  });

  describe('exportCsv', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    // Spies at the real browser-API boundary (URL.createObjectURL / anchor click) -- jsdom's
    // Blob has no .text(), so content correctness is covered separately (csvRows above and
    // csv.utils.spec.ts's own toCsv tests); this just proves the download itself fires under
    // the expected, range-named filename.
    it('downloads the CSV under a range-named file', () => {
      // arrange
      setDateRange();
      let capturedFilename = '';
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ): void {
        capturedFilename = this.download;
      });

      // act
      component.exportCsv();

      // assert & verify
      expect(capturedFilename).toBe('category-report_2026-06-01_to_2026-09-01.csv');
    });
  });
});
