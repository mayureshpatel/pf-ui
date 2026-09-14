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
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { DateRange, NetWorthDataPoint } from '../../models/reports.model';
import { ReportApiService } from '../../services/report-api.service';
import { FormatCurrencyPipe } from '@shared/pipes/format-currency.pipe';
import { PageErrorStateComponent } from '@shared/components/page-error-state/page-error-state.component';

/**
 * Sub-report component charting total net worth over time.
 *
 * Unlike the other sub-reports (which aggregate an already-loaded, shared transaction dataset
 * client-side via `ReportsDataService`), this one is backed by PF-304's dedicated backend
 * endpoint and owns its own async load, keyed off the parent-selected date range.
 */
@Component({
  selector: 'app-net-worth-report',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    ChartModule,
    ProgressSpinnerModule,
    FormatCurrencyPipe,
    PageErrorStateComponent,
  ],
  templateUrl: './net-worth-report.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NetWorthReportComponent {
  private readonly reportApi: ReportApiService = inject(ReportApiService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /** The currently selected reporting date range (owned and URL-synced by the parent). */
  readonly dateRange: InputSignal<DateRange> = input.required<DateRange>();

  /** The loaded net-worth series. */
  readonly data: WritableSignal<NetWorthDataPoint[]> = signal<NetWorthDataPoint[]>([]);

  /** Indicates a load is in flight. */
  readonly loading: WritableSignal<boolean> = signal(false);

  /** Whether the most recent load attempt failed. */
  readonly loadError: WritableSignal<boolean> = signal(false);

  /** Indicates if there is sufficient data to render the chart. */
  readonly hasData: Signal<boolean> = computed((): boolean => this.data().length > 0);

  /** The latest data point's value, for the headline summary figure. */
  readonly currentNetWorth: Signal<number | null> = computed((): number | null => {
    const points: NetWorthDataPoint[] = this.data();
    return points.length > 0 ? points[points.length - 1].netWorth : null;
  });

  constructor() {
    /** Reactively reloads the series whenever the parent-selected date range changes. */
    effect((): void => {
      this.loadNetWorth();
    });
  }

  /**
   * Fetches the net-worth series for the currently selected date range.
   */
  loadNetWorth(): void {
    const range: DateRange = this.dateRange();
    this.loading.set(true);
    this.loadError.set(false);

    this.reportApi
      .getNetWorth(range.startDate, range.endDate)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.loading.set(false)),
      )
      .subscribe({
        next: (points: NetWorthDataPoint[]): void => this.data.set(points),
        error: (err: unknown): void => {
          console.error('Net worth report load failed:', err);
          this.loadError.set(true);
        },
      });
  }

  /**
   * Derived Chart.js line/area data, matching this app's established charting conventions (see
   * `cash-flow-trend` on the dashboard, and this feature's own `income-expense-report`).
   */
  readonly chartData = computed(() => {
    const points: NetWorthDataPoint[] = this.data();

    // Parses "YYYY-MM-DD" into a local-timezone Date built from numeric parts, not from the raw
    // string -- Angular's formatDate() treats date-only ISO strings as UTC, which can roll the
    // displayed month back a day west of UTC. Matches income-expense-report's formatMonthLabel.
    const labels: string[] = points.map((p: NetWorthDataPoint): string => {
      const [year, month] = p.date.split('-');
      const date = new Date(Number.parseInt(year, 10), Number.parseInt(month, 10) - 1);
      return formatDate(date, 'MMM yy', 'en-US');
    });

    return {
      labels,
      datasets: [
        {
          label: 'Net Worth',
          data: points.map((p: NetWorthDataPoint): number => p.netWorth),
          borderColor: '#8b5cf6', // violet-500
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };
  });

  /**
   * Static chart options configuration.
   */
  readonly chartOptions = {
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
          label: (context: any): string =>
            ` Net Worth: ${formatCurrency(context.parsed.y || 0, 'en-US', '$', '1.2-2')}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false, drawBorder: false },
        ticks: { color: '#94a3b8', font: { size: 11, weight: '600' } },
      },
      y: {
        grid: { color: 'rgba(148, 163, 184, 0.1)', drawBorder: false },
        ticks: {
          color: '#94a3b8',
          font: { size: 11, family: 'monospace' },
          callback: (val: any): string =>
            `$${val >= 1000 || val <= -1000 ? val / 1000 + 'k' : val}`,
        },
      },
    },
  };
}
