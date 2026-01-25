import { Component, computed, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ProgressBarModule } from 'primeng/progressbar';
import { Select } from 'primeng/select';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { BudgetStatus } from '@models/budget.model';
import { MonthOption, YearOption } from '@models/dashboard.model';
import { BudgetApiService } from './services/budget-api.service';
import { ToastService } from '@core/services/toast.service';
import { formatCurrency } from '@shared/utils/account.utils';
import { BudgetFormDialogComponent } from './components/budget-form-dialog/budget-form-dialog.component';
import { CategoryApiService } from '@features/categories/services/category-api.service';
import { Category } from '@models/category.model';

@Component({
  selector: 'app-budgets',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    ButtonModule,
    TableModule,
    ProgressBarModule,
    Select,
    ProgressSpinnerModule,
    BudgetFormDialogComponent
  ],
  templateUrl: './budgets.component.html'
})
export class BudgetsComponent implements OnInit {
  private readonly budgetApi = inject(BudgetApiService);
  private readonly categoryApi = inject(CategoryApiService);
  private readonly toast = inject(ToastService);

  // State
  budgetStatuses: WritableSignal<BudgetStatus[]> = signal([]);
  categories: WritableSignal<Category[]> = signal([]);
  loading: WritableSignal<boolean> = signal(false);
  showDialog: WritableSignal<boolean> = signal(false);

  selectedMonth: WritableSignal<number> = signal(new Date().getMonth() + 1);
  selectedYear: WritableSignal<number> = signal(new Date().getFullYear());

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

  // Summary signals
  totalBudgeted = computed(() => this.budgetStatuses().reduce((acc, curr) => acc + curr.budgetedAmount, 0));
  totalSpent = computed(() => this.budgetStatuses().reduce((acc, curr) => acc + curr.spentAmount, 0));
  totalRemaining = computed(() => this.totalBudgeted() - this.totalSpent());

  formatCurrency = formatCurrency;

  ngOnInit(): void {
    this.initializeYearOptions();
    this.loadCategories();
    this.loadBudgetStatus();
  }

  private initializeYearOptions(): void {
    const currentYear = new Date().getFullYear();
    const years: YearOption[] = [];
    for (let year = 2020; year <= currentYear + 1; year++) {
      years.push({ label: year.toString(), value: year });
    }
    this.yearOptions = years;
  }

  private loadCategories(): void {
    this.categoryApi.getCategories().subscribe({
      next: (cats) => this.categories.set(cats),
      error: () => this.toast.error('Failed to load categories')
    });
  }

  loadBudgetStatus(): void {
    this.loading.set(true);
    this.budgetApi.getBudgetStatus(this.selectedMonth(), this.selectedYear()).subscribe({
      next: (status) => {
        this.budgetStatuses.set(status);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Failed to load budget status');
        this.loading.set(false);
      }
    });
  }

  onPeriodChange(): void {
    this.loadBudgetStatus();
  }

  openSetBudgetDialog(): void {
    this.showDialog.set(true);
  }

  onBudgetSaved(): void {
    this.showDialog.set(false);
    this.loadBudgetStatus();
  }

  getProgressBarTailwind(percentage: number): string {
    if (percentage < 80) return '!bg-green-500';
    if (percentage <= 100) return '!bg-yellow-500';
    return '!bg-red-500';
  }
}
