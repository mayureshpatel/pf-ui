import {Component, computed, DestroyRef, effect, inject, OnInit, Signal, signal, WritableSignal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {finalize, forkJoin} from 'rxjs';
import {CardModule} from 'primeng/card';
import {Select} from 'primeng/select';
import {ProgressSpinnerModule} from 'primeng/progressspinner';
import {SelectButtonModule} from 'primeng/selectbutton';

import {
  ActionItem,
  CashFlowTrend,
  CategoryBreakdown,
  DashboardPulse,
  MerchantBreakdown,
  MonthOption,
  YearOption,
  YtdSummary
} from '@models/dashboard.model';
import {DashboardApiService} from './services/dashboard-api.service';
import {CategoryApiService} from '@features/categories/services/category-api.service';
import {ToastService} from '@core/services/toast.service';
import {PulseCardComponent} from './components/pulse-card/pulse-card.component';
import {CashFlowTrendComponent} from './components/cash-flow-trend/cash-flow-trend.component';
import {YtdSummaryComponent} from './components/ytd-summary/ytd-summary.component';
import {ActionCenterComponent} from './components/action-center/action-center.component';
import {CategoryChartComponent} from './components/category-chart/category-chart.component';
import {ScreenToolbarComponent} from '@shared/components/screen-toolbar/screen-toolbar';

type RangePreset = 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR' | 'LAST_YEAR' | 'CUSTOM';

/**
 * Main dashboard component serving as the operational command center.
 *
 * Orchestrates data from multiple domains (accounts, budgets, transactions)
 * and provides reactive filtering by time period.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    Select,
    SelectButtonModule,
    ProgressSpinnerModule,
    ScreenToolbarComponent,
    PulseCardComponent,
    CashFlowTrendComponent,
    YtdSummaryComponent,
    ActionCenterComponent,
    CategoryChartComponent
  ],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit {
  private readonly dashboardApi: DashboardApiService = inject(DashboardApiService);
  private readonly categoryApi: CategoryApiService = inject(CategoryApiService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  private readonly currentDate: Date = new Date();

  /** Currently selected range preset (e.g., 'THIS_MONTH', 'CUSTOM'). */
  readonly selectedPreset: WritableSignal<RangePreset> = signal('LAST_MONTH');

  /** Currently selected month for custom filtering (1-12). */
  readonly selectedMonth: WritableSignal<number> = signal(this.currentDate.getMonth());

  /** Currently selected year for custom filtering. */
  readonly selectedYear: WritableSignal<number> = signal(this.currentDate.getFullYear());

  /** High-level financial metrics comparison (Pulse). */
  readonly pulse: WritableSignal<DashboardPulse | null> = signal(null);

  /** Cash flow trend data over time. */
  readonly trends: WritableSignal<CashFlowTrend[]> = signal([]);

  /** Year-to-date summary metrics. */
  readonly ytd: WritableSignal<YtdSummary | null> = signal(null);

  /** List of pending financial actions/alerts. */
  readonly actions: WritableSignal<ActionItem[]> = signal([]);

  /** Spending breakdown by category. */
  readonly topCategories: WritableSignal<CategoryBreakdown[]> = signal([]);

  /** Highest volume merchants for the period. */
  readonly topMerchants: WritableSignal<MerchantBreakdown[]> = signal([]);

  /** Global loading state for dashboard refresh. */
  readonly loading: WritableSignal<boolean> = signal(false);

  /**
   * Reactively calculates the specific date range based on the selected preset or custom filters.
   * This is used as the primary input for the data-loading engine.
   */
  readonly periodRange: Signal<{ start: string, end: string } | null> = computed(() => {
    const preset: RangePreset = this.selectedPreset();
    const month: number = this.selectedMonth();
    const year: number = this.selectedYear();

    if (preset === 'CUSTOM') {
      // return null to signal that custom range is selected
      return null;
    }

    let start: Date;
    let end: Date;

    switch (preset) {
      case 'THIS_MONTH':
        start = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        end = this.currentDate;
        break;
      case 'LAST_MONTH':
        start = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
        end = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 0);
        break;
      case 'THIS_YEAR':
        start = new Date(this.currentDate.getFullYear(), 0, 1);
        end = this.currentDate;
        break;
      case 'LAST_YEAR':
        start = new Date(this.currentDate.getFullYear() - 1, 0, 1);
        end = new Date(this.currentDate.getFullYear() - 1, 11, 31);
        break;
      default:
        return null;
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  });

  readonly presetOptions = [
    {label: 'This Month', value: 'THIS_MONTH'},
    {label: 'Last Month', value: 'LAST_MONTH'},
    {label: 'This Year', value: 'THIS_YEAR'},
    {label: 'Last Year', value: 'LAST_YEAR'},
    {label: 'Custom Range', value: 'CUSTOM'}
  ];

  readonly monthOptions: MonthOption[] = [
    {label: 'January', value: 1}, {label: 'February', value: 2},
    {label: 'March', value: 3}, {label: 'April', value: 4},
    {label: 'May', value: 5}, {label: 'June', value: 6},
    {label: 'July', value: 7}, {label: 'August', value: 8},
    {label: 'September', value: 9}, {label: 'October', value: 10},
    {label: 'November', value: 11}, {label: 'December', value: 12}
  ];

  yearOptions: YearOption[] = [];

  constructor() {
    /**
     * The reactive heart of the dashboard.
     * Whenever the periodRange (preset) OR specific month/year (custom) change,
     * this effect automatically triggers a data refresh.
     */
    effect((): void => {
      this.periodRange();
      this.selectedMonth();
      this.selectedYear();

      this.loadAllData();
    });
  }

  /**
   * Initializes component prerequisites.
   */
  ngOnInit(): void {
    this.initializeSelectedPeriod();
    this.initializeYearOptions();
  }

  /**
   * Fetches and aggregates all data points for the current filter set.
   */
  private loadAllData(): void {
    this.loading.set(true);
    const range = this.periodRange();
    const month: number = this.selectedMonth();
    const year: number = this.selectedYear();

    forkJoin({
      pulse: range
        ? this.dashboardApi.getPulse(undefined, undefined, range.start, range.end)
        : this.dashboardApi.getPulse(month, year),

      trends: this.dashboardApi.getCashFlowTrend(),
      ytd: this.dashboardApi.getYtdSummary(year),
      actions: this.dashboardApi.getActionItems(),

      categories: range
        ? this.dashboardApi.getCategoryBreakdown(undefined, undefined, range.start, range.end)
        : this.dashboardApi.getCategoryBreakdown(month, year),

      merchants: range
        ? this.dashboardApi.getVendorBreakdown(undefined, undefined, range.start, range.end)
        : this.dashboardApi.getVendorBreakdown(month, year)
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (res): void => {
          this.pulse.set(res.pulse);
          this.trends.set(res.trends);
          this.ytd.set(res.ytd);
          this.actions.set(res.actions);
          this.topMerchants.set(res.merchants.slice(0, 5));
          this.topCategories.set(res.categories);
        },
        error: (err: any): void => {
          console.error('Dashboard data load failed:', err);
          this.toast.error('Failed to update dashboard data.');
        }
      });
  }

  /**
   * Sets default filters to the previous month on first load.
   */
  private initializeSelectedPeriod(): void {
    if (this.currentDate.getMonth() === 0) {
      this.selectedMonth.set(12);
      this.selectedYear.set(this.currentDate.getFullYear() - 1);
    } else {
      this.selectedMonth.set(this.currentDate.getMonth());
      this.selectedYear.set(this.currentDate.getFullYear());
    }
  }

  /**
   * Populates the year selection dropdown with a sensible range.
   */
  private initializeYearOptions(): void {
    const currentYear = this.currentDate.getFullYear();
    const years: YearOption[] = [];
    for (let year = currentYear - 5; year <= currentYear + 1; year++) {
      years.push({label: year.toString(), value: year});
    }
    this.yearOptions = years;
  }

  /**
   * Returns Tailwind classes for styling the savings rate.
   * @param rate - The savings percentage.
   */
  getSavingsRateColor(rate: number | undefined): string {
    if (!rate) return 'text-surface-500';
    return rate > 0 ? 'text-emerald-600' : 'text-rose-600';
  }
}
