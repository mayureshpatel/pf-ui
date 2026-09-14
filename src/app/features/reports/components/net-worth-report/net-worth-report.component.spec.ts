import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { NetWorthReportComponent } from './net-worth-report.component';
import { ReportApiService } from '../../services/report-api.service';
import { NetWorthDataPoint } from '../../models/reports.model';

describe('NetWorthReportComponent', () => {
  let component: NetWorthReportComponent;
  let fixture: ComponentFixture<NetWorthReportComponent>;
  let mockReportApi: any;

  const mockPoints: NetWorthDataPoint[] = [
    { date: '2025-11-30', netWorth: 10000 },
    { date: '2025-12-31', netWorth: 11500 },
    { date: '2026-01-31', netWorth: 12750 },
  ];

  const setDateRange = (
    range = { startDate: '2025-11-01', endDate: '2026-01-31', label: 'Last 3 Months' },
  ): void => {
    fixture.componentRef.setInput('dateRange', range);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    mockReportApi = {
      getNetWorth: vi.fn().mockReturnValue(of(mockPoints)),
    };

    await TestBed.configureTestingModule({
      imports: [NetWorthReportComponent],
      providers: [{ provide: ReportApiService, useValue: mockReportApi }],
    }).compileComponents();

    fixture = TestBed.createComponent(NetWorthReportComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    setDateRange();

    expect(component).toBeTruthy();
  });

  it('should load the net worth series for the given date range on init', () => {
    setDateRange();

    expect(mockReportApi.getNetWorth).toHaveBeenCalledWith('2025-11-01', '2026-01-31');
    expect(component.data()).toEqual(mockPoints);
  });

  it('should reload when the date range input changes', () => {
    setDateRange();
    mockReportApi.getNetWorth.mockClear();

    setDateRange({ startDate: '2026-01-01', endDate: '2026-01-31', label: 'Custom Range' });

    expect(mockReportApi.getNetWorth).toHaveBeenCalledWith('2026-01-01', '2026-01-31');
  });

  it('should expose the latest data point as the current net worth', () => {
    setDateRange();

    expect(component.currentNetWorth()).toBe(12750);
  });

  it('should report no data and a null current net worth for an empty series', () => {
    mockReportApi.getNetWorth.mockReturnValue(of([]));

    setDateRange();

    expect(component.hasData()).toBe(false);
    expect(component.currentNetWorth()).toBeNull();
  });

  it('should set loadError and stop loading when the request fails', () => {
    mockReportApi.getNetWorth.mockReturnValue(throwError(() => new Error('network error')));

    setDateRange();

    expect(component.loadError()).toBe(true);
    expect(component.loading()).toBe(false);
  });

  it('should clear a prior loadError once a retry succeeds', () => {
    mockReportApi.getNetWorth.mockReturnValue(throwError(() => new Error('network error')));
    setDateRange();
    expect(component.loadError()).toBe(true);

    mockReportApi.getNetWorth.mockReturnValue(of(mockPoints));
    component.loadNetWorth();

    expect(component.loadError()).toBe(false);
    expect(component.data()).toEqual(mockPoints);
  });

  it('should build chart labels and data from the loaded series', () => {
    setDateRange();

    expect(component.chartData().datasets[0].data).toEqual([10000, 11500, 12750]);
    expect(component.chartData().labels).toEqual(['Nov 25', 'Dec 25', 'Jan 26']);
  });
});
