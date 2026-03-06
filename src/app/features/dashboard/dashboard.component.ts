import {Component, DestroyRef, inject, OnInit, signal, WritableSignal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {forkJoin} from 'rxjs';
import {CardModule} from 'primeng/card';
import {Select} from 'primeng/select';
import {ProgressSpinnerModule} from 'primeng/progressspinner';
import {SelectButtonModule} from 'primeng/selectbutton';
import {
  ActionItem,
  CashFlowTrend,
  CategoryTotal,
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

  readonly currentDate: Date = new Date();

  pulse: WritableSignal<DashboardPulse | null> = signal(null);
  trends: WritableSignal<CashFlowTrend[]> = signal([]);
  ytd: WritableSignal<YtdSummary | null> = signal(null);
  actions: WritableSignal<ActionItem[]> = signal([]);
  topCategories: WritableSignal<CategoryTotal[]> = signal([]);
  topMerchants: WritableSignal<MerchantBreakdown[]> = signal([]);

  loading: WritableSignal<boolean> = signal(false);

  selectedPreset: WritableSignal<RangePreset> = signal('LAST_MONTH');
  selectedMonth: WritableSignal<number> = signal(this.currentDate.getMonth() - 1);
  selectedYear: WritableSignal<number> = signal(this.currentDate.getFullYear());

  // Options
  presetOptions = [
    {label: 'This Month', value: 'THIS_MONTH'},
    {label: 'Last Month', value: 'LAST_MONTH'},
    {label: 'This Year', value: 'THIS_YEAR'},
    {label: 'Last Year', value: 'LAST_YEAR'},
    {label: 'Custom', value: 'CUSTOM'}
  ];

  monthOptions: MonthOption[] = [
    {label: 'January', value: 1},
    {label: 'February', value: 2},
    {label: 'March', value: 3},
    {label: 'April', value: 4},
    {label: 'May', value: 5},
    {label: 'June', value: 6},
    {label: 'July', value: 7},
    {label: 'August', value: 8},
    {label: 'September', value: 9},
    {label: 'October', value: 10},
    {label: 'November', value: 11},
    {label: 'December', value: 12}
  ];

  yearOptions: YearOption[] = [];

  ngOnInit(): void {
    this.initializeSelectedPeriod();
    this.initializeYearOptions();
    this.loadAllData();
  }

  private loadAllData(): void {
    this.loading.set(true);
    const range = this.calculatePeriodRange();

    forkJoin({
      // fetch pulse data
      pulse: range
        ? this.dashboardApi.getPulse(undefined, undefined, range.start, range.end)
        : this.dashboardApi.getPulse(this.selectedMonth(), this.selectedYear()),

      // fetch trend data
      trends: this.dashboardApi.getCashFlowTrend(),

      // fetch YTD summary
      ytd: this.dashboardApi.getYtdSummary(this.currentDate.getFullYear()),

      // fetch action item data
      actions: this.dashboardApi.getActionItems(),

      // fetch category breakdown data
      categories: range
        ? this.dashboardApi.getCategoryBreakdown(undefined, undefined, range.start, range.end)
        : this.dashboardApi.getCategoryBreakdown(this.selectedMonth(), this.selectedYear()),

      // fetch merchant breakdown data
      // todo: merchants will include income/expense/transfer transactions; will need to figure out how to get only
      //  expenses; merchant breakdown will need to change in the backend
      merchants: range
        ? this.dashboardApi.getVendorBreakdown(undefined, undefined, range.start, range.end)
        : this.dashboardApi.getVendorBreakdown(this.selectedMonth(), this.selectedYear()),

      // fetch all categories
      categoryMeta: this.categoryApi.getCategories()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (results): void => {
          this.pulse.set(results.pulse);
          this.trends.set(results.trends);
          this.ytd.set(results.ytd);
          this.actions.set(results.actions);
          this.topMerchants.set(results.merchants.slice(0, 5));
          this.topCategories.set(results.categories);

          this.loading.set(false);
        },
        error: (): void => {
          this.toast.error('Failed to load dashboard data');
          this.loading.set(false);
        }
      });
  }

  /**
   * Initializes the selected period to the previous month.
   * <br><br>
   * Handles an edge-case of January being the current month.
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
   * Initializes the year options array so that the select dropdown only
   * has options starting from 2020 up to the following year of the current year.
   *
   * todo: look into initializing year options based on transactions in the database;
   *  might be best to have a simple query to get first and last transactions by date
   */
  private initializeYearOptions(): void {
    const currentYear: number = this.currentDate.getFullYear();
    const years: YearOption[] = [];

    for (let year: number = currentYear - 5; year <= currentYear + 1; year++) {
      years.push({label: year.toString(), value: year});
    }
    this.yearOptions = years;
  }

  /**
   * When the user changes the period, reload the data.
   */
  onPeriodChange(): void {
    this.loadAllData();
  }

  /**
   * Returns tailwind classes for styling savings rate value based on positive/negative percentage.
   * @param rate the savings rate
   * @returns text red or green, based on the negative/positive value, respectively
   */
  getSavingsRateColor(rate: number | undefined): string {
    if (rate === undefined || rate === 0) return 'text-color';
    return rate > 0 ? 'text-green-600' : 'text-red-600';
  }


  private calculatePeriodRange(): { start: string, end: string } | null {
    const preset: RangePreset = this.selectedPreset();
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
      case 'CUSTOM':
        return null;
      default:
        return null;
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  }
}
