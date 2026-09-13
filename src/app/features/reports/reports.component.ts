import {ChangeDetectionStrategy, Component, DestroyRef, effect, inject, OnInit, signal, WritableSignal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {finalize, skip} from 'rxjs';
import {TabsModule} from 'primeng/tabs';
import {ProgressSpinnerModule} from 'primeng/progressspinner';

import {PageRequest, PageResponse, Transaction, TransactionFilter} from '@models/transaction.model';
import {TransactionApiService} from '../transactions/services/transaction-api.service';
import {ToastService} from '@core/services/toast.service';
import {ScreenToolbarComponent} from '@shared/components/screen-toolbar/screen-toolbar';
import {DateRangeFilterComponent} from './components/date-range-filter/date-range-filter.component';
import {CategoryReportComponent} from './components/category-report/category-report.component';
import {MerchantReportComponent} from './components/merchant-report/merchant-report.component';
import {IncomeExpenseReportComponent} from './components/income-expense-report/income-expense-report.component';
import {DateRange} from './models/reports.model';
import {fromLocalDateString, toLocalDateString} from '@shared/utils/transaction.utils';
import {PageErrorStateComponent} from '@shared/components/page-error-state/page-error-state.component';

/**
 * Main reporting hub providing visual analytics and deep-dive spending patterns.
 *
 * Coordinates data fetching based on selected date ranges and distributes
 * transaction datasets to specialized sub-report widgets.
 */
@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule,
    TabsModule,
    ProgressSpinnerModule,
    ScreenToolbarComponent,
    DateRangeFilterComponent,
    CategoryReportComponent,
    MerchantReportComponent,
    IncomeExpenseReportComponent,
    PageErrorStateComponent
  ],
  templateUrl: './reports.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportsComponent implements OnInit {
  private readonly transactionApi: TransactionApiService = inject(TransactionApiService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly router: Router = inject(Router);

  /** The currently active date range for the reports. */
  readonly dateRange: WritableSignal<DateRange> = signal(this.getDefaultDateRange());

  /** The dataset of transactions for the selected range. */
  readonly transactions: WritableSignal<Transaction[]> = signal([]);

  /** Global loading state for report generation. */
  readonly loading: WritableSignal<boolean> = signal(false);

  /** Whether the most recent load attempt failed. */
  readonly loadError: WritableSignal<boolean> = signal(false);

  /** Currently selected tab (0: Category, 1: Merchant, 2: Monthly). */
  readonly activeTabIndex: WritableSignal<number> = signal(0);

  constructor() {
    /**
     * Core effect that reactively reloads the transaction dataset and syncs the URL
     * whenever the user changes the global date range filters.
     */
    effect((): void => {
      const range: DateRange = this.dateRange();
      this.updateUrlParams(range);
      this.loadTransactions();
    });
  }

  /**
   * Hydrates the date range from URL query params on load, then keeps it in sync with later
   * external navigation (e.g. browser back/forward), so the selection survives a refresh and is
   * shareable as a link.
   */
  ngOnInit(): void {
    this.hydrateFromParams(this.route.snapshot.queryParams);

    this.route.queryParams
      .pipe(skip(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((params: Params): void => this.hydrateFromParams(params));
  }

  /**
   * Fetches the relevant transaction dataset from the API based on current filters.
   *
   * Requests a large page size (1000) to ensure the aggregation engine
   * has a comprehensive dataset for visual analytics.
   */
  loadTransactions(): void {
    const range: DateRange = this.dateRange();
    this.loading.set(true);
    this.loadError.set(false);

    const filter: TransactionFilter = {
      startDate: fromLocalDateString(range.startDate),
      endDate: fromLocalDateString(range.endDate)
    };

    const pageRequest: PageRequest = {
      page: 0,
      size: 1000,
      sort: 'date,desc'
    };

    this.transactionApi.getTransactions(filter, pageRequest)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.loading.set(false))
      )
      .subscribe({
        next: (page: PageResponse<Transaction>): void => this.transactions.set(page.content),
        error: (err: any): void => {
          console.error('Report data load failed:', err);
          this.toast.error('Failed to load report data. Please try again.');
          this.loadError.set(true);
        }
      });
  }

  /**
   * Translates URL query params into the date-range signal, only writing when the parsed value
   * actually differs from the current one -- avoids re-triggering the sync effect for a URL
   * change that just echoes the state that produced it.
   */
  private hydrateFromParams(params: Params): void {
    const startDate: string | undefined = params['startDate'];
    const endDate: string | undefined = params['endDate'];
    if (!startDate || !endDate) {
      return;
    }

    const current: DateRange = this.dateRange();
    if (startDate !== current.startDate || endDate !== current.endDate) {
      this.dateRange.set({startDate, endDate, label: params['label'] || 'Custom Range'});
    }
  }

  /**
   * Serializes the current date range to URL query params. Always written (never omitted as a
   * "default"), since reports always has some active range -- unlike transactions' filters, there's
   * no meaningful "no range selected" state to treat as elidable.
   */
  private updateUrlParams(range: DateRange): void {
    this.router.navigate([], {
      queryParams: {startDate: range.startDate, endDate: range.endDate, label: range.label},
      queryParamsHandling: 'replace',
      replaceUrl: true
    });
  }

  /**
   * Generates the default report period (Last 3 Months).
   * @returns A pre-populated DateRange object.
   */
  private getDefaultDateRange(): DateRange {
    const end: Date = new Date();
    const start: Date = new Date();
    start.setMonth(start.getMonth() - 3);

    return {
      startDate: toLocalDateString(start),
      endDate: toLocalDateString(end),
      label: 'Last 3 Months'
    };
  }
}
