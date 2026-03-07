import {Component, computed, DestroyRef, inject, OnInit, Signal, signal, WritableSignal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {finalize} from 'rxjs';
import {CardModule} from 'primeng/card';
import {ButtonModule} from 'primeng/button';
import {TableModule} from 'primeng/table';
import {ProgressBarModule} from 'primeng/progressbar';
import {Select} from 'primeng/select';
import {SelectButton} from 'primeng/selectbutton';
import {CheckboxModule} from 'primeng/checkbox';
import {ProgressSpinnerModule} from 'primeng/progressspinner';
import {Tooltip} from 'primeng/tooltip';
import {ConfirmationService} from 'primeng/api';

import {Budget, BudgetStatus} from '@models/budget.model';
import {Category} from '@models/category.model';
import {MonthOption, YearOption} from '@models/dashboard.model';
import {BudgetApiService} from './services/budget-api.service';
import {CategoryApiService} from '@features/categories/services/category-api.service';
import {ToastService} from '@core/services/toast.service';
import {ScreenToolbarComponent} from '@shared/components/screen-toolbar/screen-toolbar';
import {BudgetFormDialogComponent} from './components/budget-form-dialog/budget-form-dialog.component';
import {FormatCurrencyPipe} from '@shared/pipes/format-currency.pipe';
import {getCategoryColor} from '@shared/utils/category.utils';

/**
 * Component for managing and tracking monthly budgets.
 *
 * Provides two view modes:
 * 1. Monthly Status: Tracks spending against budgets for a specific month/year.
 * 2. Manage All: A flat list of all defined budgets for administrative actions.
 */
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
  private readonly budgetApi: BudgetApiService = inject(BudgetApiService);
  private readonly categoryApi: CategoryApiService = inject(CategoryApiService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly confirmationService: ConfirmationService = inject(ConfirmationService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /** The list of budgets status for the selected month/year. */
  readonly budgetStatuses: WritableSignal<BudgetStatus[]> = signal([]);

  /** The list of all budgets ever created (for management). */
  readonly allBudgets: WritableSignal<Budget[]> = signal([]);

  /** Available categories for creating new budgets. */
  readonly categories: WritableSignal<Category[]> = signal([]);

  /** Global loading state for API operations. */
  readonly loading: WritableSignal<boolean> = signal(false);

  /** Visibility of the set-budget dialog. */
  readonly showDialog: WritableSignal<boolean> = signal(false);

  /** Current view mode: 'monthly' status or 'all' list. */
  readonly viewMode: WritableSignal<'monthly' | 'all'> = signal('monthly');

  /** Currently selected month (1-12). Defaults to current month. */
  readonly selectedMonth: WritableSignal<number> = signal(new Date().getMonth() + 1);

  /** Currently selected year. Defaults to current year. */
  readonly selectedYear: WritableSignal<number> = signal(new Date().getFullYear());

  /** Sum of all budgeted amounts for the selected period. */
  readonly totalBudgeted: Signal<number> = computed((): number =>
    this.budgetStatuses().reduce((acc, curr): number => acc + curr.budgetedAmount, 0)
  );

  /** Sum of all spent amounts for the selected period. */
  readonly totalSpent: Signal<number> = computed((): number =>
    this.budgetStatuses().reduce((acc, curr): number => acc + curr.spentAmount, 0)
  );

  /** Difference between total budgeted and total spent. */
  readonly totalRemaining: Signal<number> = computed((): number =>
    this.totalBudgeted() - this.totalSpent()
  );

  /** Overall percentage of the total budget spent. */
  readonly totalSpentPercentage: Signal<number> = computed((): number => {
    const budgeted: number = this.totalBudgeted();

    if (budgeted === 0) {
      return 0;
    }
    return (this.totalSpent() / budgeted) * 100;
  });

  readonly viewOptions = [
    {label: 'Monthly Status', value: 'monthly', icon: 'pi pi-calendar'},
    {label: 'Manage All', value: 'all', icon: 'pi pi-list'}
  ];

  readonly monthOptions: MonthOption[] = [
    {label: 'January', value: 1}, {label: 'February', value: 2},
    {label: 'March', value: 3}, {label: 'April', value: 4},
    {label: 'May', value: 5}, {label: 'June', value: 6},
    {label: 'July', value: 7}, {label: 'August', value: 8},
    {label: 'September', value: 9}, {label: 'October', value: 10},
    {label: 'November', value: 11}, {label: 'December', value: 12}
  ];

  yearOptions: YearOption[] = [];
  getCategoryColor = getCategoryColor;

  /**
   * Initializes component data.
   */
  ngOnInit(): void {
    this.initializeYearOptions();
    this.loadCategories();
    this.refreshData();
  }

  /**
   * Populates year options for the filter dropdown.
   */
  private initializeYearOptions(): void {
    const currentYear: number = new Date().getFullYear();
    const years: YearOption[] = [];

    for (let year: number = 2020; year <= currentYear + 1; year++) {
      years.push({label: year.toString(), value: year});
    }
    this.yearOptions = years;
  }

  /**
   * Fetches all categories from the API.
   */
  private loadCategories(): void {
    this.categoryApi.getCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories: Category[]): void => this.categories.set(categories),
        error: (err: any): void => {
          console.error('Failed to load categories:', err);
          this.toast.error('Failed to load categories');
        }
      });
  }

  /**
   * Refreshes the budget data based on the current view mode.
   */
  refreshData(): void {
    if (this.viewMode() === 'all') {
      this.loadAllBudgets();
    } else {
      this.loadBudgetStatus();
    }
  }

  /**
   * Loads the budget status summary for the selected period.
   */
  private loadBudgetStatus(): void {
    this.loading.set(true);
    this.budgetApi.getBudgetStatus(this.selectedMonth(), this.selectedYear())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.loading.set(false))
      )
      .subscribe({
        next: (status: BudgetStatus[]): void => this.budgetStatuses.set(status),
        error: (err: any): void => {
          console.error('Failed to load budget status:', err);
          this.toast.error('Failed to load budget status');
        }
      });
  }

  /**
   * Loads a flat list of all budgets for management.
   */
  private loadAllBudgets(): void {
    this.loading.set(true);
    this.budgetApi.getAllBudgets()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.loading.set(false))
      )
      .subscribe({
        next: (budgets: Budget[]): void => this.allBudgets.set(budgets),
        error: (err: any): void => {
          console.error('Failed to load all budgets:', err);
          this.toast.error('Failed to load all budgets');
        }
      });
  }

  /**
   * Responds to changes in the month or year filters.
   */
  onPeriodChange(): void {
    this.loadBudgetStatus();
  }

  /**
   * Responds to view mode toggle.
   */
  onToggleView(): void {
    this.refreshData();
  }

  /**
   * Opens the budget creation dialog.
   */
  openSetBudgetDialog(): void {
    this.showDialog.set(true);
  }

  /**
   * Callback for when a budget is saved successfully in the child dialog.
   */
  onBudgetSaved(): void {
    this.showDialog.set(false);
    this.refreshData();
  }

  /**
   * Deletes a specific budget entry.
   * @param budget The budget object to delete.
   */
  deleteBudget(budget: Budget): void {
    this.confirmationService.confirm({
      header: 'Delete Budget?',
      message: `Are you sure you want to delete the budget for ${budget.category.name} in ${this.getMonthName(budget.month)} ${budget.year}?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: (): void => {
        this.budgetApi.deleteBudget(budget.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (): void => {
              this.toast.success('Budget deleted successfully');
              this.refreshData();
            },
            error: (err: any): void => {
              console.error('Failed to delete budget:', err);
              this.toast.error('Failed to delete budget');
            }
          });
      }
    });
  }

  /**
   * Maps a month number to its human-readable name.
   * @param month The month number (1-12).
   */
  getMonthName(month: number): string {
    return this.monthOptions.find((m: MonthOption): boolean => m.value === month)?.label || month.toString();
  }

  /**
   * Returns appropriate Tailwind classes for the progress bar based on utilization.
   * @param percentage The percentage of the budget used.
   */
  getProgressBarTailwind(percentage: number): string {
    if (percentage < 80) return '!bg-emerald-500';
    if (percentage <= 100) return '!bg-amber-500';
    return '!bg-rose-500';
  }
}
