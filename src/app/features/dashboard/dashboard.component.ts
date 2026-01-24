import { Component, inject, OnInit, signal, WritableSignal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { CardModule } from 'primeng/card';
import { Select } from 'primeng/select';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { 
  DashboardPulse, 
  CashFlowTrend, 
  YtdSummary, 
  ActionItem, 
  MonthOption, 
  YearOption,
  CategoryTotal
} from '@models/dashboard.model';
import { Account } from '@models/account.model';
import { DashboardApiService } from './services/dashboard-api.service';
import { AccountApiService } from '@features/accounts/services/account-api.service';
import { ToastService } from '@core/services/toast.service';
import { PulseCardComponent } from './components/pulse-card/pulse-card.component';
import { CashFlowTrendComponent } from './components/cash-flow-trend/cash-flow-trend.component';
import { YtdSummaryComponent } from './components/ytd-summary/ytd-summary.component';
import { ActionCenterComponent } from './components/action-center/action-center.component';
import { CategoryChartComponent } from './components/category-chart/category-chart.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    Select,
    ProgressSpinnerModule,
    PulseCardComponent,
    CashFlowTrendComponent,
    YtdSummaryComponent,
    ActionCenterComponent,
    CategoryChartComponent
  ],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit {
  private readonly dashboardApi = inject(DashboardApiService);
  private readonly accountApi = inject(AccountApiService);
  private readonly toast = inject(ToastService);

  // State
  pulse: WritableSignal<DashboardPulse | null> = signal(null);
  trends: WritableSignal<CashFlowTrend[]> = signal([]);
  ytd: WritableSignal<YtdSummary | null> = signal(null);
  actions: WritableSignal<ActionItem[]> = signal([]);
  topCategories: WritableSignal<CategoryTotal[]> = signal([]);
  
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
    this.loadAllData();
  }

  private initializeYearOptions(): void {
    const currentYear = new Date().getFullYear();
    const years: YearOption[] = [];
    for (let year = 2020; year <= currentYear + 1; year++) {
      years.push({ label: year.toString(), value: year });
    }
    this.yearOptions = years;
  }

  private loadAccounts(): void {
    this.accountApi.getAccounts().subscribe({
      next: (accounts) => this.accounts.set(accounts),
      error: () => this.toast.error('Failed to load accounts')
    });
  }

  onFilterChange(): void {
    // Note: Backend doesn't support account filtering for these specific widgets yet
    this.toast.info('Account filtering will be added in a future update');
  }

  onPeriodChange(): void {
    this.loadAllData();
  }

  private loadAllData(): void {
    this.loading.set(true);
    
    forkJoin({
      pulse: this.dashboardApi.getPulse(this.selectedMonth(), this.selectedYear()),
      trends: this.dashboardApi.getCashFlowTrend(),
      ytd: this.dashboardApi.getYtdSummary(this.selectedYear()),
      actions: this.dashboardApi.getActionItems(),
      categories: this.dashboardApi.getCategoryBreakdown(this.selectedMonth(), this.selectedYear())
    }).subscribe({
      next: (results) => {
        this.pulse.set(results.pulse);
        this.trends.set(results.trends);
        this.ytd.set(results.ytd);
        this.actions.set(results.actions);
        this.topCategories.set(results.categories);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Failed to load dashboard data');
        this.loading.set(false);
      }
    });
  }
}
