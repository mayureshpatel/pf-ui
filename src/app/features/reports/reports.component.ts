import { Component, OnInit, inject, signal, computed, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabsModule } from 'primeng/tabs';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { Transaction, TransactionFilter, PageRequest } from '@models/transaction.model';
import { TransactionApiService } from '../transactions/services/transaction-api.service';
import { ToastService } from '@core/services/toast.service';
import { ScreenToolbarComponent } from '@shared/components/screen-toolbar/screen-toolbar';
import { DateRangeFilterComponent } from './components/date-range-filter/date-range-filter.component';
import { CategoryReportComponent } from './components/category-report/category-report.component';
import { VendorReportComponent } from './components/vendor-report/vendor-report.component';
import { IncomeExpenseReportComponent } from './components/income-expense-report/income-expense-report.component';
import { DateRange } from './models/reports.model';

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
  private readonly transactionApi = inject(TransactionApiService);
  private readonly toast = inject(ToastService);

  // State
  protected dateRange: WritableSignal<DateRange> = signal(this.getDefaultDateRange());
  protected transactions: WritableSignal<Transaction[]> = signal([]);
  protected loading: WritableSignal<boolean> = signal(false);
  protected activeTabIndex: WritableSignal<number> = signal(0);

  // Computed
  protected hasData = computed(() => this.transactions().length > 0);

  ngOnInit(): void {
    this.loadTransactions();
  }

  protected onDateRangeChange(newRange: DateRange): void {
    this.dateRange.set(newRange);
    this.loadTransactions();
  }

  private loadTransactions(): void {
    this.loading.set(true);
    const range = this.dateRange();

    const filter: TransactionFilter = {
      startDate: range.startDate,
      endDate: range.endDate
    };

    // Fetch transactions with large page size to get all data for aggregation
    const pageRequest: PageRequest = {
      page: 0,
      size: 10000,
      sort: 'date,desc'
    };

    this.transactionApi.getTransactions(filter, pageRequest)
      .subscribe({
        next: (page) => {
          this.transactions.set(page.content);
          this.loading.set(false);
        },
        error: () => {
          this.toast.error('Failed to load report data');
          this.loading.set(false);
        }
      });
  }

  private getDefaultDateRange(): DateRange {
    // Last 3 months by default
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);

    return {
      startDate: this.formatDateToISO(startDate),
      endDate: this.formatDateToISO(endDate),
      label: 'Last 3 Months'
    };
  }

  private formatDateToISO(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
