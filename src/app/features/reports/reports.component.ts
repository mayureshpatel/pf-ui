import {Component, DestroyRef, effect, inject, OnInit, signal, WritableSignal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {finalize} from 'rxjs';
import {TabsModule} from 'primeng/tabs';
import {ProgressSpinnerModule} from 'primeng/progressspinner';

import {PageRequest, PageResponse, Transaction, TransactionFilter} from '@models/transaction.model';
import {TransactionApiService} from '../transactions/services/transaction-api.service';
import {ToastService} from '@core/services/toast.service';
import {ScreenToolbarComponent} from '@shared/components/screen-toolbar/screen-toolbar';
import {DateRangeFilterComponent} from './components/date-range-filter/date-range-filter.component';
import {CategoryReportComponent} from './components/category-report/category-report.component';
import {VendorReportComponent} from './components/vendor-report/vendor-report.component';
import {IncomeExpenseReportComponent} from './components/income-expense-report/income-expense-report.component';
import {DateRange} from './models/reports.model';

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
    VendorReportComponent,
    IncomeExpenseReportComponent
  ],
  templateUrl: './reports.component.html'
})
export class ReportsComponent implements OnInit {
  private readonly transactionApi: TransactionApiService = inject(TransactionApiService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /** The currently active date range for the reports. */
  readonly dateRange: WritableSignal<DateRange> = signal(this.getDefaultDateRange());

  /** The dataset of transactions for the selected range. */
  readonly transactions: WritableSignal<Transaction[]> = signal([]);

  /** Global loading state for report generation. */
  readonly loading: WritableSignal<boolean> = signal(false);

  /** Currently selected tab (0: Category, 1: Vendor, 2: Monthly). */
  readonly activeTabIndex: WritableSignal<number> = signal(0);

  constructor() {
    /**
     * Core effect that reactively reloads the transaction dataset
     * whenever the user changes the global date range filters.
     */
    effect((): void => {
      this.dateRange(); // Track as dependency
      this.loadTransactions();
    });
  }

  /**
   * Initializes component data on first load.
   */
  ngOnInit(): void {
    this.loadTransactions();
  }

  /**
   * Fetches the relevant transaction dataset from the API based on current filters.
   *
   * Requests a large page size (1000) to ensure the aggregation engine
   * has a comprehensive dataset for visual analytics.
   */
  private loadTransactions(): void {
    const range: DateRange = this.dateRange();
    this.loading.set(true);

    const filter: TransactionFilter = {
      startDate: range.startDate,
      endDate: range.endDate
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
        }
      });
  }

  /**
   * Generates the default report period (Last 3 Months).
   * @returns A pre-populated DateRange object.
   */
  private getDefaultDateRange(): DateRange {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 3);

    return {
      startDate: this.formatDateToISO(start),
      endDate: this.formatDateToISO(end),
      label: 'Last 3 Months'
    };
  }

  /**
   * Local utility to format a date into an ISO string (YYYY-MM-DD).
   * @param date - The date object to format.
   */
  private formatDateToISO(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
