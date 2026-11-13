import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnInit,
  Signal,
  signal,
  untracked,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin, Subscription } from 'rxjs';
import { CardModule } from 'primeng/card';
import { Select } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { SelectButtonModule } from 'primeng/selectbutton';

import {
  ActionItem,
  CashFlowTrend,
  CategoryBreakdown,
  DashboardPulse,
  MerchantBreakdown,
  MonthOption,
  YearOption,
  YtdSummary,
} from '@models/dashboard.model';
import { DashboardApiService } from './services/dashboard-api.service';
import { CategoryApiService } from '@features/categories/services/category-api.service';
import { ToastService } from '@core/services/toast.service';
import { PulseCardComponent } from './components/pulse-card/pulse-card.component';
import { CashFlowTrendComponent } from './components/cash-flow-trend/cash-flow-trend.component';
import { YtdSummaryComponent } from './components/ytd-summary/ytd-summary.component';
import { KeptCardComponent } from './components/kept-card/kept-card.component';
import { ReviewBannerComponent } from './components/review-banner/review-banner.component';
import {
  describePeriod,
  formatRange,
  monthRange,
  previousMonthRange,
  previousRange,
} from './utils/period-label';
import {
  buildPeriodParams,
  parsePeriodParams,
  PeriodPreset,
  PeriodSelection,
  YEARS_AHEAD,
  YEARS_BACK,
} from './utils/period-url';
import { CategoryChartComponent } from './components/category-chart/category-chart.component';
import { EmptyPeriodComponent, LatestData } from './components/empty-period/empty-period.component';
import { TransactionApiService } from '@features/transactions/services/transaction-api.service';
import { ScreenToolbarComponent } from '@shared/components/screen-toolbar/screen-toolbar';
import { FormatCurrencyPipe } from '@shared/pipes/format-currency.pipe';
import { toLocalDateString } from '@shared/utils/transaction.utils';
import { PageErrorStateComponent } from '@shared/components/page-error-state/page-error-state.component';

type RangePreset = PeriodPreset;

/**
 * Main dashboard component: how the user is doing this period, plus what needs review.
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
    RouterLink,
    CardModule,
    Select,
    SelectButtonModule,
    SkeletonModule,
    ScreenToolbarComponent,
    PulseCardComponent,
    CashFlowTrendComponent,
    YtdSummaryComponent,
    KeptCardComponent,
    ReviewBannerComponent,
    CategoryChartComponent,
    EmptyPeriodComponent,
    FormatCurrencyPipe,
    PageErrorStateComponent,
  ],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly dashboardApi: DashboardApiService = inject(DashboardApiService);
  private readonly categoryApi: CategoryApiService = inject(CategoryApiService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly transactionApi: TransactionApiService = inject(TransactionApiService);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly router: Router = inject(Router);

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

  /** Whether the most recent load attempt failed. */
  readonly loadError: WritableSignal<boolean> = signal(false);

  /**
   * Reactively calculates the specific date range based on the selected preset or custom filters.
   * This is used as the primary input for the data-loading engine.
   */
  readonly periodRange: Signal<{ start: string; end: string } | null> = computed(() => {
    const preset: RangePreset = this.selectedPreset();

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
      start: toLocalDateString(start),
      end: toLocalDateString(end),
    };
  });

  /**
   * The calendar year the "so far" card reports on: the year the selected period ends in, or the
   * picked year for a custom month. Keeping it tied to the period stops the card from showing the
   * current year while the rest of the page shows another one.
   */
  readonly ytdYear: Signal<number> = computed((): number => {
    const range = this.periodRange();
    return range ? Number(range.end.slice(0, 4)) : this.selectedYear();
  });

  /** The in-flight load, cancelled when a newer one starts so a slow reply can't overwrite it. */
  private loadSubscription: Subscription | null = null;

  /** Identifies the latest load so a cancelled one never clears the loading flag. */
  private loadId = 0;

  /**
   * The selected period as the `yyyy-MM-dd` dates the Transactions page filters by: the preset's
   * range, or the whole picked month for a custom period.
   */
  private readonly transactionDates: Signal<{ startDate: string; endDate: string }> = computed(
    () => {
      const range = this.periodRange() ?? monthRange(this.selectedMonth(), this.selectedYear());
      return { startDate: range.start, endDate: range.end };
    },
  );

  /** Transactions query for the income behind the Income card. */
  readonly incomeLink: Signal<Params> = computed((): Params => ({
    type: 'INCOME',
    ...this.transactionDates(),
  }));

  /** Transactions query for the spending behind the Expenses card, categories and merchants. */
  readonly expenseLink: Signal<Params> = computed((): Params => ({
    type: 'EXPENSE',
    ...this.transactionDates(),
  }));

  /**
   * Transactions query for one merchant's spending in the selected period.
   *
   * @param merchantName - The merchant's display name, which the Transactions page filters by.
   */
  merchantLink(merchantName: string): Params {
    return { ...this.expenseLink(), merchant: merchantName };
  }

  /** The selected period as people say it, for example "October 2026". */
  readonly periodLabel: Signal<string> = computed((): string =>
    formatRange(this.periodRange() ?? monthRange(this.selectedMonth(), this.selectedYear())),
  );

  /**
   * Whether the selected period has no income and no spending at all. Zero against a prior figure
   * reads as a 100% change, so an empty period gets its own state instead of the usual cards.
   */
  readonly isEmptyPeriod: Signal<boolean> = computed((): boolean => {
    const pulse: DashboardPulse | null = this.pulse();
    return pulse !== null && pulse.currentIncome === 0 && pulse.currentExpense === 0;
  });

  /** The date (yyyy-MM-dd) of the most recent transaction, looked up only when a period is empty. */
  private readonly latestDataDate: WritableSignal<string | null> = signal(null);

  /**
   * The latest month with data and the dashboard link that opens it, or null when there is
   * nowhere useful to jump: no data, data already inside this period, or a month the picker
   * does not offer.
   */
  readonly latestJump: Signal<LatestData | null> = computed((): LatestData | null => {
    const date: string | null = this.latestDataDate();
    if (!date || !/^\d{4}-\d{2}/.test(date)) {
      return null;
    }
    const year = Number(date.slice(0, 4));
    const month = Number(date.slice(5, 7));
    const range = this.periodRange() ?? monthRange(this.selectedMonth(), this.selectedYear());
    if (date.slice(0, 10) >= range.start && date.slice(0, 10) <= range.end) {
      return null;
    }
    const link: Params = buildPeriodParams('CUSTOM', month, year);
    if (!parsePeriodParams(link, this.currentDate, this.defaultMonthYear())) {
      return null;
    }
    return { label: formatRange(monthRange(month, year)), link };
  });

  /**
   * Plain-language description of the selected period and what it is compared with. Mirrors the
   * backend: a custom month is compared with the previous calendar month, a preset range with
   * the immediately preceding window of the same number of days.
   */
  readonly periodSubtitle: Signal<string> = computed((): string => {
    const range = this.periodRange();
    if (range) {
      return describePeriod(range, previousRange(range));
    }

    const month: number = this.selectedMonth();
    const year: number = this.selectedYear();
    return describePeriod(monthRange(month, year), previousMonthRange(month, year));
  });

  readonly presetOptions = [
    { label: 'This Month', value: 'THIS_MONTH' },
    { label: 'Last Month', value: 'LAST_MONTH' },
    { label: 'This Year', value: 'THIS_YEAR' },
    { label: 'Last Year', value: 'LAST_YEAR' },
    { label: 'Custom Range', value: 'CUSTOM' },
  ];

  readonly monthOptions: MonthOption[] = [
    { label: 'January', value: 1 },
    { label: 'February', value: 2 },
    { label: 'March', value: 3 },
    { label: 'April', value: 4 },
    { label: 'May', value: 5 },
    { label: 'June', value: 6 },
    { label: 'July', value: 7 },
    { label: 'August', value: 8 },
    { label: 'September', value: 9 },
    { label: 'October', value: 10 },
    { label: 'November', value: 11 },
    { label: 'December', value: 12 },
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

    // keep the URL in step with the selected period, so Back from a drill-through, a bookmark
    // and a shared link all return to the same view
    effect((): void => {
      const preset: RangePreset = this.selectedPreset();
      const month: number = this.selectedMonth();
      const year: number = this.selectedYear();
      untracked((): void => this.writePeriodToUrl(preset, month, year));
    });

    // when a period turns out to be empty, find where the data is so the empty state can point
    effect((): void => {
      if (this.isEmptyPeriod()) {
        untracked((): void => this.loadLatestDataDate());
      }
    });
  }

  /**
   * Initializes component prerequisites.
   */
  ngOnInit(): void {
    this.initializeSelectedPeriod();
    this.initializeYearOptions();

    // the URL is the source of truth on arrival and whenever it changes, such as the Dashboard
    // nav link returning to the default
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params: Params): void => this.applyPeriodFromUrl(params));
  }

  /**
   * Fetches and aggregates all data points for the current filter set.
   */
  loadAllData(): void {
    this.loadSubscription?.unsubscribe();
    const loadId: number = ++this.loadId;
    this.loading.set(true);
    this.loadError.set(false);
    const range = this.periodRange();
    const month: number = this.selectedMonth();
    const year: number = this.selectedYear();

    this.loadSubscription = forkJoin({
      pulse: range
        ? this.dashboardApi.getPulse(undefined, undefined, range.start, range.end)
        : this.dashboardApi.getPulse(month, year),

      trends: this.dashboardApi.getCashFlowTrend(),
      ytd: this.dashboardApi.getYtdSummary(this.ytdYear()),
      actions: this.dashboardApi.getActionItems(),

      categories: range
        ? this.dashboardApi.getCategoryBreakdown(undefined, undefined, range.start, range.end)
        : this.dashboardApi.getCategoryBreakdown(month, year),

      merchants: range
        ? this.dashboardApi.getMerchantBreakdown(undefined, undefined, range.start, range.end)
        : this.dashboardApi.getMerchantBreakdown(month, year),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => {
          if (loadId === this.loadId) {
            this.loading.set(false);
          }
        }),
      )
      .subscribe({
        next: (res): void => {
          this.pulse.set(res.pulse);
          this.trends.set(res.trends);
          this.ytd.set(res.ytd);
          this.actions.set(res.actions);
          // the endpoint returns merchants unordered, so rank before taking the top 5
          this.topMerchants.set(
            [...res.merchants].sort((a, b): number => b.total - a.total).slice(0, 5),
          );
          this.topCategories.set(res.categories);
        },
        error: (err: unknown): void => {
          console.error('Dashboard data load failed:', err);
          this.toast.error('Failed to update dashboard data.');
          this.loadError.set(true);
        },
      });
  }

  /** Looks up the most recent transaction's date, ignoring the selected period. */
  private loadLatestDataDate(): void {
    this.latestDataDate.set(null);
    this.transactionApi
      .getTransactions({}, { page: 0, size: 1, sort: 'date,desc' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page): void => this.latestDataDate.set(page.content[0]?.date ?? null),
        error: (): void => this.latestDataDate.set(null),
      });
  }

  /**
   * The month and year the dashboard opens on: the previous month, wrapping January to December.
   */
  private defaultMonthYear(): { month: number; year: number } {
    return this.currentDate.getMonth() === 0
      ? { month: 12, year: this.currentDate.getFullYear() - 1 }
      : { month: this.currentDate.getMonth(), year: this.currentDate.getFullYear() };
  }

  /**
   * Sets default filters to the previous month on first load.
   */
  private initializeSelectedPeriod(): void {
    const { month, year } = this.defaultMonthYear();
    this.selectedMonth.set(month);
    this.selectedYear.set(year);
  }

  /**
   * Applies the period described by the URL, or the default when the URL describes none.
   *
   * @param params - The route's query params.
   */
  private applyPeriodFromUrl(params: Params): void {
    const fallback = this.defaultMonthYear();
    const period: PeriodSelection = parsePeriodParams(params, this.currentDate, fallback) ?? {
      preset: 'LAST_MONTH',
      ...fallback,
    };
    this.selectedPreset.set(period.preset);
    this.selectedMonth.set(period.month);
    this.selectedYear.set(period.year);
  }

  /**
   * Writes the selected period to the URL, replacing the current history entry so each click
   * does not add one, and skipping the write when the URL already says the same thing.
   */
  private writePeriodToUrl(preset: RangePreset, month: number, year: number): void {
    const next: Params = buildPeriodParams(preset, month, year);
    const current: Params = this.route.snapshot.queryParams;
    const same: boolean = ['period', 'month', 'year'].every(
      (key: string): boolean => String(next[key] ?? '') === String(current[key] ?? ''),
    );
    if (same) {
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: next,
      replaceUrl: true,
    });
  }

  /**
   * Populates the year selection dropdown with a sensible range.
   */
  private initializeYearOptions(): void {
    const currentYear = this.currentDate.getFullYear();
    const years: YearOption[] = [];
    for (let year = currentYear - YEARS_BACK; year <= currentYear + YEARS_AHEAD; year++) {
      years.push({ label: year.toString(), value: year });
    }
    this.yearOptions = years;
  }
}
