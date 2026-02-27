import {Component, DestroyRef, inject, OnDestroy, OnInit, signal, WritableSignal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
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
export class ReportsComponent implements OnInit, OnDestroy {
  // injected services
  private readonly transactionApi: TransactionApiService = inject(TransactionApiService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  // signals
  protected dateRange: WritableSignal<DateRange> = signal(this.getDefaultDateRange());
  protected transactions: WritableSignal<Transaction[]> = signal([]);
  protected loading: WritableSignal<boolean> = signal(false);
  protected activeTabIndex: WritableSignal<number> = signal(0);

  ngOnInit(): void {
    this.loadTransactions();
  }

  ngOnDestroy(): void {
    this.transactions.set([]);
  }

  protected onDateRangeChange(newRange: DateRange): void {
    this.dateRange.set(newRange);
    this.loadTransactions();
  }

  private loadTransactions(): void {
    this.loading.set(true);
    const range: DateRange = this.dateRange();

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
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page: PageResponse<Transaction>): void => {
          this.transactions.set(page.content);
          this.loading.set(false);
        },
        error: (): void => {
          this.toast.error('Failed to load report data');
          this.loading.set(false);
        }
      });
  }

  private getDefaultDateRange(): DateRange {
    // Last 3 months by default
    const endDate: Date = new Date();
    const startDate: Date = new Date();
    startDate.setMonth(startDate.getMonth() - 3);

    return {
      startDate: this.formatDateToISO(startDate),
      endDate: this.formatDateToISO(endDate),
      label: 'Last 3 Months'
    };
  }

  private formatDateToISO(date: Date): string {
    const year: number = date.getFullYear();
    const month: string = String(date.getMonth() + 1).padStart(2, '0');
    const day: string = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
