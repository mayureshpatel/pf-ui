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
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { ReportApiService } from '../../services/report-api.service';
import { CategoryReportData, DateRange } from '../../models/reports.model';
import { getCategoryColor } from '@shared/utils/category.utils';
import { FormatCurrencyPipe } from '@shared/pipes/format-currency.pipe';
import { downloadCsv, toCsv } from '@shared/utils/csv.utils';
import { PageErrorStateComponent } from '@shared/components/page-error-state/page-error-state.component';

/**
 * Sub-report component for analyzing spending by category.
 *
 * Provides a horizontal bar chart of the top 10 categories and a detailed breakdown table showing
 * transaction volume and averages. Backed by PF-823's dedicated backend endpoint and owns its own
 * async load, keyed off the parent-selected date range -- matching `NetWorthReportComponent`'s
 * established pattern, replacing the old client-side aggregation over a page-capped transaction
 * array that could silently understate totals past 1000 matching rows.
 */
@Component({
  selector: 'app-category-report',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    ChartModule,
    TableModule,
    ButtonModule,
    ProgressSpinnerModule,
    FormatCurrencyPipe,
    PageErrorStateComponent,
  ],
  templateUrl: './category-report.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryReportComponent {
  private readonly reportApi: ReportApiService = inject(ReportApiService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /** The currently selected reporting date range (owned and URL-synced by the parent). */
  readonly dateRange: InputSignal<DateRange> = input.required<DateRange>();

  /** The loaded category breakdown. */
  readonly categoryData: WritableSignal<CategoryReportData[]> = signal<CategoryReportData[]>([]);

  /** Indicates a load is in flight. */
  readonly loading: WritableSignal<boolean> = signal(false);

  /** Whether the most recent load attempt failed. */
  readonly loadError: WritableSignal<boolean> = signal(false);

  /** Indicates if there is sufficient data to render visuals. */
  readonly hasData: Signal<boolean> = computed((): boolean => this.categoryData().length > 0);

  constructor() {
    /** Reactively reloads the breakdown whenever the parent-selected date range changes. */
    effect((): void => {
      this.loadCategoryData();
    });
  }

  /**
   * Fetches the category breakdown for the currently selected date range.
   */
  loadCategoryData(): void {
    const range: DateRange = this.dateRange();
    this.loading.set(true);
    this.loadError.set(false);

    this.reportApi
      .getCategoryBreakdown(range.startDate, range.endDate)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.loading.set(false)),
      )
      .subscribe({
        next: (data: CategoryReportData[]): void => this.categoryData.set(data),
        error: (err: unknown): void => {
          console.error('Category report load failed:', err);
          this.loadError.set(true);
        },
      });
  }

  /**
   * Derived Chart.js data object.
   * Uses pure computed signal for maximum performance.
   */
  readonly chartData = computed(() => {
    const data: CategoryReportData[] = this.categoryData().slice(0, 10); // Show top 10

    return {
      labels: data.map((c: CategoryReportData): string => c.category.name),
      datasets: [
        {
          label: 'Total Spent',
          data: data.map((c: CategoryReportData): number => c.total),
          backgroundColor: data.map(
            (c: CategoryReportData): string =>
              c.category.color || getCategoryColor(c.category.name),
          ),
          borderRadius: 8,
          barThickness: 32,
          hoverBackgroundColor: data.map(
            (c: CategoryReportData): string =>
              c.category.color || getCategoryColor(c.category.name),
          ),
        },
      ],
    };
  });

  /**
   * Static chart options configuration.
   */
  readonly chartOptions = {
    indexAxis: 'y',
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e293b',
        padding: 12,
        titleFont: { size: 14, weight: 'bold' },
        bodyFont: { size: 13, family: 'monospace' },
        usePointStyle: true,
        callbacks: {
          label: (context: any): string => {
            const val: any = context.parsed.x || 0;
            return ` Total Spent: ${formatCurrency(val, 'en-US', '$', '1.2-2')}`;
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: 'rgba(148, 163, 184, 0.1)', drawBorder: false },
        ticks: {
          color: '#94a3b8',
          font: { size: 11, family: 'monospace' },
          callback: (val: any): string => `$${val >= 1000 ? val / 1000 + 'k' : val}`,
        },
      },
      y: {
        grid: { display: false, drawBorder: false },
        ticks: {
          color: '#64748b',
          font: { size: 12, weight: '700' },
        },
      },
    },
  };

  /**
   * CSV rows for the current category breakdown (PF-306): a header row followed by one row per
   * category, built from the same `categoryData()` used everywhere else in this component --
   * already the full, unfiltered breakdown for the selected date range (the chart's own top-10
   * slice is a local view, not a truncation of this signal), so there's no need to round-trip to
   * the server for data already in hand.
   */
  readonly csvRows: Signal<string[][]> = computed((): string[][] => [
    ['Category', 'Total', 'Transaction Count', 'Avg / Txn'],
    ...this.categoryData().map((c: CategoryReportData): string[] => [
      c.category.name,
      c.total.toFixed(2),
      c.count.toString(),
      c.avgTransaction.toFixed(2),
    ]),
  ]);

  /**
   * Exports `csvRows()` as a downloaded CSV file, named for the current report and date range.
   */
  exportCsv(): void {
    const range: DateRange = this.dateRange();
    const filename = `category-report_${range.startDate}_to_${range.endDate}.csv`;
    downloadCsv(filename, toCsv(this.csvRows()));
  }
}
