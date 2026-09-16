import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  InputSignal,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { CommonModule, formatCurrency } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { ReportApiService } from '../../services/report-api.service';
import { DateRange, MerchantReportData } from '../../models/reports.model';
import { FormatCurrencyPipe } from '@shared/pipes/format-currency.pipe';
import { PageErrorStateComponent } from '@shared/components/page-error-state/page-error-state.component';

/**
 * Sub-report component for analyzing spending volume by merchant.
 *
 * Provides a horizontal bar chart for volume leaders, a doughnut chart for distribution, and a
 * detailed merchant list with associated categories. Backed by PF-823's dedicated backend endpoint
 * and owns its own async load, keyed off the parent-selected date range -- matching
 * `NetWorthReportComponent`'s established pattern, replacing the old client-side aggregation over
 * a page-capped transaction array that could silently understate totals past 1000 matching rows.
 */
@Component({
  selector: 'app-merchant-report',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    ChartModule,
    TableModule,
    TagModule,
    ProgressSpinnerModule,
    FormatCurrencyPipe,
    PageErrorStateComponent,
  ],
  templateUrl: './merchant-report.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantReportComponent {
  private readonly reportApi: ReportApiService = inject(ReportApiService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /** The currently selected reporting date range (owned and URL-synced by the parent). */
  readonly dateRange: InputSignal<DateRange> = input.required<DateRange>();

  /** The loaded merchant breakdown. */
  readonly merchantData: WritableSignal<MerchantReportData[]> = signal<MerchantReportData[]>([]);

  /** Indicates a load is in flight. */
  readonly loading: WritableSignal<boolean> = signal(false);

  /** Whether the most recent load attempt failed. */
  readonly loadError: WritableSignal<boolean> = signal(false);

  /** Indicates if there is sufficient data to render visuals. */
  readonly hasData: Signal<boolean> = computed((): boolean => this.merchantData().length > 0);

  constructor() {
    /** Reactively reloads the breakdown whenever the parent-selected date range changes. */
    effect((): void => {
      this.loadMerchantData();
    });
  }

  /**
   * Fetches the merchant breakdown for the currently selected date range.
   */
  loadMerchantData(): void {
    const range: DateRange = this.dateRange();
    this.loading.set(true);
    this.loadError.set(false);

    this.reportApi
      .getMerchantBreakdown(range.startDate, range.endDate)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.loading.set(false)),
      )
      .subscribe({
        next: (data: MerchantReportData[]): void => this.merchantData.set(data),
        error: (err: unknown): void => {
          console.error('Merchant report load failed:', err);
          this.loadError.set(true);
        },
      });
  }

  /**
   * Derived Bar Chart data for volume leaders.
   */
  readonly barChartData: Signal<any> = computed(() => {
    const data: MerchantReportData[] = this.merchantData().slice(0, 10);

    return {
      labels: data.map((v: MerchantReportData): string => v.displayName),
      datasets: [
        {
          label: 'Total Spent',
          data: data.map((v: MerchantReportData): number => v.total),
          backgroundColor: data.map(
            (_: MerchantReportData, i: number): string => `hsl(${(i * 36) % 360}, 70%, 60%)`,
          ),
          borderRadius: 8,
          barThickness: 32,
        },
      ],
    };
  });

  /**
   * Derived Doughnut Chart data for spending distribution.
   */
  readonly doughnutChartData: Signal<any> = computed(() => {
    const data: MerchantReportData[] = this.merchantData().slice(0, 5);

    return {
      labels: data.map((v: MerchantReportData): string => v.displayName),
      datasets: [
        {
          data: data.map((v: MerchantReportData): number => v.total),
          backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
          hoverOffset: 20,
          borderWidth: 0,
        },
      ],
    };
  });

  /**
   * Static chart options for the bar chart.
   */
  readonly barChartOptions = {
    indexAxis: 'y',
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e293b',
        padding: 12,
        usePointStyle: true,
        callbacks: {
          label: (context: any): string =>
            ` Total: ${formatCurrency(context.parsed.x || 0, 'en-US', '$', '1.2-2')}`,
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: 'rgba(148, 163, 184, 0.1)', drawBorder: false },
        ticks: { color: '#94a3b8', font: { size: 11, family: 'monospace' } },
      },
      y: {
        grid: { display: false },
        ticks: { color: '#64748b', font: { size: 12, weight: '700' } },
      },
    },
  };

  /**
   * Static chart options for the doughnut chart.
   */
  readonly doughnutChartOptions = {
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20,
          font: { size: 11, weight: 'bold' },
        },
      },
      tooltip: {
        backgroundColor: '#1e293b',
        padding: 12,
        callbacks: {
          label: (context: any): string => {
            const val: any = context.parsed || 0;
            const total: number = context.dataset.data.reduce(
              (a: number, b: number): number => a + b,
              0,
            );
            const pct: string = ((val / total) * 100).toFixed(1);
            return ` ${context.label}: ${formatCurrency(val, 'en-US', '$', '1.2-2')} (${pct}%)`;
          },
        },
      },
    },
  };
}
