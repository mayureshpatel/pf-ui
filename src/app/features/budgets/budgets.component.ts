import {Component, computed, inject, OnInit, signal, WritableSignal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {forkJoin} from 'rxjs';
import {CardModule} from 'primeng/card';
import {ButtonModule} from 'primeng/button';
import {TableModule} from 'primeng/table';
import {ProgressBarModule} from 'primeng/progressbar';
import {Select} from 'primeng/select';
import {SelectButton} from 'primeng/selectbutton';
import {CheckboxModule} from 'primeng/checkbox';
import {ConfirmDialog} from 'primeng/confirmdialog';
import {ProgressSpinnerModule} from 'primeng/progressspinner';
import {Budget, BudgetStatus} from '@models/budget.model';
import {MonthOption, YearOption} from '@models/dashboard.model';
import {BudgetApiService} from './services/budget-api.service';
import {ToastService} from '@core/services/toast.service';
import {ConfirmationService} from 'primeng/api';
import {formatCurrency} from '@shared/utils/account.utils';
import {BudgetFormDialogComponent} from './components/budget-form-dialog/budget-form-dialog.component';
import {CategoryApiService} from '@features/categories/services/category-api.service';
import {Category} from '@models/category.model';
import {getCategoryColor} from '@shared/utils/category.utils';

export interface BudgetStatusViewModel extends BudgetStatus {
  icon?: string;
  color?: string;
}

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
    SelectButton,
    CheckboxModule,
    ConfirmDialog,
    ProgressSpinnerModule,
    BudgetFormDialogComponent
  ],
  providers: [ConfirmationService],
  templateUrl: './budgets.component.html'
})
export class BudgetsComponent implements OnInit {
  private readonly budgetApi = inject(BudgetApiService);
  private readonly categoryApi = inject(CategoryApiService);
  private readonly toast = inject(ToastService);
  private readonly confirmationService = inject(ConfirmationService);

  // State
  budgetStatuses: WritableSignal<BudgetStatusViewModel[]> = signal([]);
  allBudgets: WritableSignal<Budget[]> = signal([]);
  categories: WritableSignal<Category[]> = signal([]);
  loading: WritableSignal<boolean> = signal(false);
  showDialog: WritableSignal<boolean> = signal(false);
  viewMode: WritableSignal<'monthly' | 'all'> = signal('monthly');

  selectedMonth: WritableSignal<number> = signal(new Date().getMonth() + 1);
  selectedYear: WritableSignal<number> = signal(new Date().getFullYear());

  // Options
  viewOptions = [
    {label: 'Monthly Status', value: 'monthly', icon: 'pi pi-calendar'},
    {label: 'Manage All', value: 'all', icon: 'pi pi-list'}
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

  // Summary signals
  totalBudgeted = computed(() => this.budgetStatuses().reduce((acc, curr) => acc + curr.budgetedAmount, 0));
  totalSpent = computed(() => this.budgetStatuses().reduce((acc, curr) => acc + curr.spentAmount, 0));
  totalRemaining = computed(() => this.totalBudgeted() - this.totalSpent());

  formatCurrency = formatCurrency;
  getCategoryColor = getCategoryColor;

  ngOnInit(): void {
    this.initializeYearOptions();
    this.loadCategories();
    this.refreshData();
  }

  private initializeYearOptions(): void {
    const currentYear = new Date().getFullYear();
    const years: YearOption[] = [];
    for (let year = 2020; year <= currentYear + 1; year++) {
      years.push({label: year.toString(), value: year});
    }
    this.yearOptions = years;
  }

  private loadCategories(): void {
    this.categoryApi.getCategories().subscribe({
      next: (cats) => this.categories.set(cats),
      error: () => this.toast.error('Failed to load categories')
    });
  }

  refreshData(): void {
    if (this.viewMode() === 'all') {
      this.loadAllBudgets();
    } else {
      this.loadBudgetStatus();
    }
  }

  loadBudgetStatus(): void {
    this.loading.set(true);

    forkJoin({
      status: this.budgetApi.getBudgetStatus(this.selectedMonth(), this.selectedYear()),
      categories: this.categoryApi.getCategories()
    }).subscribe({
      next: ({status, categories}) => {
        const catMap = new Map(categories.map(c => [c.name, c]));

        const enriched = status.map(s => {
          const cat = catMap.get(s.categoryName);
          return {
            ...s,
            icon: cat?.icon,
            color: cat?.color || getCategoryColor(s.categoryName)
          };
        });

        this.budgetStatuses.set(enriched);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Failed to load budget status');
        this.loading.set(false);
      }
    });
  }

  loadAllBudgets(): void {
    this.loading.set(true);
    this.budgetApi.getAllBudgets().subscribe({
      next: (budgets) => {
        this.allBudgets.set(budgets);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Failed to load all budgets');
        this.loading.set(false);
      }
    });
  }

  onPeriodChange(): void {
    this.loadBudgetStatus();
  }

  onToggleView(): void {
    this.refreshData();
  }

  openSetBudgetDialog(): void {
    this.showDialog.set(true);
  }

  onBudgetSaved(): void {
    this.showDialog.set(false);
    this.refreshData();
  }

  deleteBudget(budget: Budget): void {
    this.confirmationService.confirm({
      header: 'Delete Budget?',
      message: `Are you sure you want to delete the budget for ${budget.categoryName} in ${budget.month}/${budget.year}?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.budgetApi.deleteBudget(budget.id).subscribe({
          next: () => {
            this.toast.success('Budget deleted successfully');
            this.refreshData();
          },
          error: () => this.toast.error('Failed to delete budget')
        });
      }
    });
  }

  getMonthName(month: number): string {
    return this.monthOptions.find(m => m.value === month)?.label || month.toString();
  }

  getProgressBarTailwind(percentage: number): string {
    if (percentage < 80) return '!bg-green-500';
    if (percentage <= 100) return '!bg-yellow-500';
    return '!bg-red-500';
  }
}
