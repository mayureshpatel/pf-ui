import { Component, inject, OnInit, signal, WritableSignal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { Select } from 'primeng/select';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DashboardData, DailyBalance, MonthOption, YearOption } from '@models/dashboard.model';
import { Account } from '@models/account.model';
import { DashboardApiService } from './services/dashboard-api.service';
import { AccountApiService } from '@features/accounts/services/account-api.service';
import { ToastService } from '@core/services/toast.service';
import { SummaryCardsComponent } from './components/summary-cards/summary-cards.component';
import { CategoryChartComponent } from './components/category-chart/category-chart.component';
import { NetWorthChartComponent } from './components/net-worth-chart/net-worth-chart.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    Select,
    ProgressSpinnerModule,
    SummaryCardsComponent,
    CategoryChartComponent,
    NetWorthChartComponent
  ],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit {
  private readonly dashboardApi = inject(DashboardApiService);
  private readonly accountApi = inject(AccountApiService);
  private readonly toast = inject(ToastService);

  // State
  dashboardData: WritableSignal<DashboardData | null> = signal(null);
  allDashboardData: WritableSignal<DashboardData | null> = signal(null); // Unfiltered data
  netWorthHistory: WritableSignal<DailyBalance[]> = signal([]);
  accounts: WritableSignal<Account[]> = signal([]);
  loading: WritableSignal<boolean> = signal(false);

  selectedMonth: WritableSignal<number> = signal(new Date().getMonth() + 1);
  selectedYear: WritableSignal<number> = signal(new Date().getFullYear());
  selectedAccountId: WritableSignal<number | null> = signal(null);

  // Options
  monthOptions: MonthOption[] = [
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
    { label: 'December', value: 12 }
  ];

  yearOptions: YearOption[] = [];

  accountOptions = computed(() => {
    return [
      { label: 'All Accounts', value: null },
      ...this.accounts().map(a => ({ label: a.name, value: a.id }))
    ];
  });

  ngOnInit(): void {
    this.initializeYearOptions();
    this.loadAccounts();
    this.loadDashboardData();
    this.loadNetWorthHistory();
  }

  private initializeYearOptions(): void {
    const currentYear = new Date().getFullYear();
    const years: YearOption[] = [];

    // Generate years from 2020 to next year
    for (let year = 2020; year <= currentYear + 1; year++) {
      years.push({ label: year.toString(), value: year });
    }

    this.yearOptions = years;
  }

  private loadAccounts(): void {
    this.accountApi.getAccounts().subscribe({
      next: (accounts) => {
        this.accounts.set(accounts);
      },
      error: () => {
        this.toast.error('Failed to load accounts');
      }
    });
  }

  onFilterChange(): void {
    this.applyAccountFilter();
  }

  onPeriodChange(): void {
    this.loadDashboardData();
  }

  private loadDashboardData(): void {
    this.loading.set(true);
    this.dashboardApi.getDashboardData(this.selectedMonth(), this.selectedYear()).subscribe({
      next: (data) => {
        this.allDashboardData.set(data);
        this.applyAccountFilter();
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Failed to load dashboard data');
        this.loading.set(false);
      }
    });
  }

  private applyAccountFilter(): void {
    const data = this.allDashboardData();
    if (!data) {
      this.dashboardData.set(null);
      return;
    }

    const accountId = this.selectedAccountId();
    if (accountId === null) {
      // Show all data
      this.dashboardData.set(data);
    } else {
      // Note: Backend doesn't support account filtering yet
      // For now, we'll show a message that this feature requires backend support
      this.toast.info('Account filtering will be available in a future update');
      this.dashboardData.set(data);
    }
  }

  private loadNetWorthHistory(): void {
    this.dashboardApi.getNetWorthHistory().subscribe({
      next: (history) => {
        this.netWorthHistory.set(history);
      },
      error: () => {
        this.toast.error('Failed to load net worth history');
      }
    });
  }
}
