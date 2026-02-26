import {Component, computed, inject, OnInit, Signal, signal, WritableSignal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {CardModule} from 'primeng/card';
import {ButtonModule} from 'primeng/button';
import {TableModule} from 'primeng/table';
import {ProgressBarModule} from 'primeng/progressbar';
import {Select} from 'primeng/select';
import {SelectButton} from 'primeng/selectbutton';
import {CheckboxModule} from 'primeng/checkbox';
import {ProgressSpinnerModule} from 'primeng/progressspinner';
import {Budget, BudgetStatus} from '@models/budget.model';
import {MonthOption, YearOption} from '@models/dashboard.model';
import {BudgetApiService} from './services/budget-api.service';
import {ToastService} from '@core/services/toast.service';
import {ConfirmationService} from 'primeng/api';
import {BudgetFormDialogComponent} from './components/budget-form-dialog/budget-form-dialog.component';
import {CategoryApiService} from '@features/categories/services/category-api.service';
import {Category} from '@models/category.model';
import {getCategoryColor} from '@shared/utils/category.utils';
import {ScreenToolbarComponent} from '@shared/components/screen-toolbar/screen-toolbar';
import {FormatCurrencyPipe} from '@shared/pipes/format-currency.pipe';
import {Tooltip} from 'primeng/tooltip';

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
    ProgressSpinnerModule,
    ScreenToolbarComponent,
    BudgetFormDialogComponent,
    FormatCurrencyPipe,
    Tooltip
  ],
  templateUrl: './budgets.component.html'
})
export class BudgetsComponent implements OnInit {
  // injected services
  private readonly budgetApi: BudgetApiService = inject(BudgetApiService);
  private readonly categoryApi: CategoryApiService = inject(CategoryApiService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly confirmationService: ConfirmationService = inject(ConfirmationService);

  // signals
  budgetStatuses: WritableSignal<BudgetStatus[]> = signal([]);
  allBudgets: WritableSignal<Budget[]> = signal([]);
  categories: WritableSignal<Category[]> = signal([]);
  loading: WritableSignal<boolean> = signal(false);
  showDialog: WritableSignal<boolean> = signal(false);
  viewMode: WritableSignal<'monthly' | 'all'> = signal('monthly');

  selectedMonth: WritableSignal<number> = signal(new Date().getMonth() + 1);
  selectedYear: WritableSignal<number> = signal(new Date().getFullYear());

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

  // computed signals
  totalBudgeted: Signal<number> = computed((): number => this.budgetStatuses()
    .reduce((acc: number, curr: BudgetStatus): number => acc + curr.budgetedAmount, 0));

  totalSpent: Signal<number> = computed((): number => this.budgetStatuses()
    .reduce((acc: number, curr: BudgetStatus): number => acc + curr.spentAmount, 0));

  totalRemaining: Signal<number> = computed((): number => this.totalBudgeted() - this.totalSpent());

  getCategoryColor = getCategoryColor;

  ngOnInit(): void {
    this.initializeYearOptions();
    this.loadCategories();
    this.refreshData();
  }

  private initializeYearOptions(): void {
    const currentYear: number = new Date().getFullYear();
    const years: YearOption[] = [];

    for (let year: number = 2020; year <= currentYear + 1; year++) {
      years.push({label: year.toString(), value: year});
    }
    this.yearOptions = years;
  }

  private loadCategories(): void {
    this.categoryApi.getCategories().subscribe({
      next: (categories: Category[]): void => {
        this.categories.set(categories)
      },
      error: (error: any): void => {
        console.error('Failed to load categories:', error);
        this.toast.error('Failed to load categories')
      }
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

    this.budgetApi.getBudgetStatus(this.selectedMonth(), this.selectedYear())
      .subscribe({
        next: (status: BudgetStatus[]): void => {
          this.budgetStatuses.set(status);
          this.loading.set(false);
        },
        error: (error: any): void => {
          console.error('Failed to load budget status:', error);
          this.toast.error('Failed to load budget status');
          this.loading.set(false);
        }
      });
  }

  loadAllBudgets(): void {
    this.loading.set(true);

    this.budgetApi.getAllBudgets().subscribe({
      next: (budgets: Budget[]): void => {
        this.allBudgets.set(budgets);
        this.loading.set(false);
      },
      error: (error: any): void => {
        console.error('Failed to load all budgets:', error);
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
      message: `Are you sure you want to delete the budget for ${budget.category.name} in ${budget.month}/${budget.year}?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: (): void => {
        this.budgetApi.deleteBudget(budget.id).subscribe({
          next: (): void => {
            this.toast.success('Budget deleted successfully');
            this.refreshData();
          },
          error: (error: any): void => {
            console.error('Failed to delete budget:', error);
            this.toast.error('Failed to delete budget')
          }
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
