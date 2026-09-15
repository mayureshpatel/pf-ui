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
import { CommonModule, formatCurrency, formatDate } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { ReportApiService } from '../../services/report-api.service';
import { DateRange, MonthlyReportData } from '../../models/reports.model';
import { FormatCurrencyPipe } from '@shared/pipes/format-currency.pipe';
import { PageErrorStateComponent } from '@shared/components/page-error-state/page-error-state.component';

/**
 * Sub-report component for analyzing income vs. expense trends over time.
 *
 * Provides a stacked bar chart for monthly comparisons and a line chart for net savings trends,
 * accompanied by a detailed summary table. Backed by PF-823's dedicated backend endpoint and owns
 * its own async load, keyed off the parent-selected date range -- matching
 * `NetWorthReportComponent`'s established pattern, replacing the old client-side aggregation over
 * a page-capped transaction array that could silently understate totals past 1000 matching rows.
 */
@Component({
  selector: 'app-income-expense-report',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    ChartModule,
    TableModule,
    ProgressSpinnerModule,
    FormatCurrencyPipe,
    PageErrorStateComponent,
  ],
  templateUrl: './income-expense-report.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncomeExpenseReportComponent {
  private readonly reportApi: ReportApiService = inject(ReportApiService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /** The currently selected reporting date range (owned and URL-synced by the parent). */
  readonly dateRange: InputSignal<DateRange> = input.required<DateRange>();

  /** The loaded monthly income/expense breakdown. */
  readonly monthlyData: WritableSignal<MonthlyReportData[]> = signal<MonthlyReportData[]>([]);

  /** Indicates a load is in flight. */
  readonly loading: WritableSignal<boolean> = signal(false);

  /** Whether the most recent load attempt failed. */
  readonly loadError: WritableSignal<boolean> = signal(false);

  /** Indicates if there is sufficient data to render visuals. */
  readonly hasData: Signal<boolean> = computed(() => this.monthlyData().length > 0);

  constructor() {
    /** Reactively reloads the breakdown whenever the parent-selected date range changes. */
    effect((): void => {
      this.loadMonthlyData();
    });
  }

  /**
   * Fetches the monthly income/expense breakdown for the currently selected date range.
   */
  loadMonthlyData(): void {
    const range: DateRange = this.dateRange();
    this.loading.set(true);
    this.loadError.set(false);

    this.reportApi
      .getMonthlyBreakdown(range.startDate, range.endDate)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.loading.set(false)),
      )
      .subscribe({
        next: (data: MonthlyReportData[]): void => this.monthlyData.set(data),
        error: (err: unknown): void => {
          console.error('Income/expense report load failed:', err);
          this.loadError.set(true);
        },
      });
  }

  /**
   * Derived Stacked Bar Chart data for Income vs Expense comparison.
   */
  readonly stackedBarData: Signal<any> = computed(() => {
    const data: MonthlyReportData[] = this.monthlyData();
    const labels: string[] = data.map((m: MonthlyReportData): string =>
      this.formatMonthLabel(m.month),
    );

    return {
      labels,
      datasets: [
        {
          label: 'Income',
          backgroundColor: '#10b981', // emerald-500
          borderRadius: 4,
          data: data.map((m: MonthlyReportData): number => m.income),
        },
        {
          label: 'Expenses',
          backgroundColor: '#f43f5e', // rose-500
          borderRadius: 4,
          data: data.map((m: MonthlyReportData): number => Math.abs(m.expense)),
        },
      ],
    };
  });

  /**
   * Derived Line Chart data for Net Savings trend analysis.
   */
  readonly lineChartData: Signal<any> = computed(() => {
    const data: MonthlyReportData[] = this.monthlyData();
    const labels: string[] = data.map((m: MonthlyReportData): string =>
      this.formatMonthLabel(m.month),
    );

    return {
      labels,
      datasets: [
        {
          label: 'Net Savings',
          data: data.map((m: MonthlyReportData): number => m.netSavings),
          borderColor: '#3b82f6', // primary blue
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };
  });

  /**
   * Configuration for the stacked bar chart.
   */
  readonly stackedBarOptions = {
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          font: { weight: 'bold' },
          color: '#64748b',
        },
      },
      tooltip: {
        backgroundColor: '#1e293b',
        padding: 12,
        callbacks: {
          label: (context: any): string =>
            ` ${context.dataset.label}: ${formatCurrency(context.parsed.y || 0, 'en-US', '$', '1.2-2')}`,
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { color: '#94a3b8', font: { size: 11, weight: '600' } },
      },
      y: {
        stacked: true,
        grid: { color: 'rgba(148, 163, 184, 0.1)', drawBorder: false },
        ticks: {
          color: '#94a3b8',
          font: { size: 11, family: 'monospace' },
          callback: (v: any) => `$${v >= 1000 ? v / 1000 + 'k' : v}`,
        },
      },
    },
  };

  /**
   * Configuration for the net savings line chart.
   */
  readonly lineChartOptions = {
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e293b',
        padding: 12,
        callbacks: {
          label: (context: any): string =>
            ` Net Savings: ${formatCurrency(context.parsed.y || 0, 'en-US', '$', '1.2-2')}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#94a3b8', font: { size: 11, weight: '600' } },
      },
      y: {
        grid: { color: 'rgba(148, 163, 184, 0.1)', drawBorder: false },
        ticks: {
          color: '#94a3b8',
          font: { size: 11, family: 'monospace' },
          callback: (v: any): string => `$${v >= 1000 ? v / 1000 + 'k' : v}`,
        },
      },
    },
  };

  /**
   * Formats a YYYY-MM string into a human-readable "MMM YY" label.
   */
  private formatMonthLabel(monthStr: string): string {
    const [year, month] = monthStr.split('-');
    const date = new Date(Number.parseInt(year), Number.parseInt(month) - 1);
    return formatDate(date, 'MMM yy', 'en-US');
  }

  /**
   * Returns semantic color classes for savings values.
   */
  getSavingsClass(net: number): string {
    return net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
  }
}
