import {Component, computed, DestroyRef, inject, OnInit, Signal, signal, WritableSignal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {CommonModule} from '@angular/common';
import {Router} from '@angular/router';
import {finalize, forkJoin, Observable} from 'rxjs';
import {ButtonModule} from 'primeng/button';
import {TableModule} from 'primeng/table';
import {ProgressBarModule} from 'primeng/progressbar';
import {CardModule} from 'primeng/card';
import {TooltipModule} from 'primeng/tooltip';
import {ConfirmationService} from 'primeng/api';
import {CategoryApiService} from './services/category-api.service';
import {TransactionApiService} from '@features/transactions/services/transaction-api.service';
import {BudgetApiService} from '@features/budgets/services/budget-api.service';
import {CategoryFormDrawerComponent} from './components/category-form-drawer/category-form-drawer.component';
import {ToastService} from '@core/services/toast.service';
import {ScreenToolbarComponent} from '@shared/components/screen-toolbar/screen-toolbar';
import {FormatCurrencyPipe} from '@shared/pipes/format-currency.pipe';
import {BudgetStatus} from '@models/budget.model';
import {
  Category,
  CategoryBudgetGroup,
  CategoryCreateRequest,
  CategoryTransactionCount,
  CategoryUpdateRequest
} from '@models/category.model';

/**
 * Component for managing financial categories.
 *
 * Displays categories in a grouped table with usage statistics and
 * budget progress. It aggregates data from categories, transactions, and budgets
 * to provide a comprehensive overview.
 */
@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TableModule,
    ProgressBarModule,
    CardModule,
    TooltipModule,
    ScreenToolbarComponent,
    CategoryFormDrawerComponent,
    FormatCurrencyPipe
  ],
  templateUrl: './categories.component.html'
})
export class CategoriesComponent implements OnInit {
  private readonly categoryApi: CategoryApiService = inject(CategoryApiService);
  private readonly transactionApi: TransactionApiService = inject(TransactionApiService);
  private readonly budgetApi: BudgetApiService = inject(BudgetApiService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly confirmationService: ConfirmationService = inject(ConfirmationService);
  private readonly router: Router = inject(Router);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /** The enriched list of categories for the table view. */
  readonly categoryViewModels: WritableSignal<CategoryBudgetGroup[]> = signal([]);

  /** Global loading state for API operations. */
  readonly loading: WritableSignal<boolean> = signal(false);

  /** Visibility of the category creation/edit drawer. */
  readonly showDialog: WritableSignal<boolean> = signal(false);

  /** The category currently selected for editing. */
  readonly selectedCategory: WritableSignal<Category | null> = signal(null);

  /** Indicates if there are no categories to display. */
  readonly isEmpty: Signal<boolean> = computed((): boolean =>
    this.categoryViewModels().length === 0 && !this.loading()
  );

  /**
   * Initializes component data.
   */
  ngOnInit(): void {
    this.loadData();
  }

  /**
   * Fetches and aggregates data from categories, transactions, and budgets.
   *
   * Orchestrates a forkJoin to fetch all required data points and then
   * enriches the categories with usage counts and budget progress.
   */
  loadData(): void {
    this.loading.set(true);
    const now = new Date();

    forkJoin({
      categories: this.categoryApi.getCategories(),
      transactionCounts: this.transactionApi.getCountsByCategory(),
      budgetStatuses: this.budgetApi.getBudgetStatus(now.getMonth() + 1, now.getFullYear())
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.loading.set(false))
      )
      .subscribe({
        next: ({categories, transactionCounts, budgetStatuses}): void => {
          this.categoryViewModels.set(this.enrichCategories(categories, transactionCounts, budgetStatuses));
        },
        error: (err: any): void => {
          console.error('Failed to load category data:', err);
          this.toast.error('Failed to load categories');
        }
      });
  }

  /**
   * Transforms raw data into enriched View Models.
   *
   * @param categories - The list of raw categories.
   * @param counts - Transaction counts mapped to category IDs.
   * @param budgets - Budget status summaries for the current month.
   * @returns A sorted list of enriched CategoryBudgetGroups.
   */
  private enrichCategories(
    categories: Category[],
    counts: CategoryTransactionCount[],
    budgets: BudgetStatus[]
  ): CategoryBudgetGroup[] {
    const budgetMap = new Map(budgets.map((b: BudgetStatus) => [b.category.name, b]));

    const enriched: CategoryBudgetGroup[] = categories.map((cat: Category): CategoryBudgetGroup => {
      const count: number = counts.find((c: CategoryTransactionCount): boolean => c.id === cat.id)?.transactionCount ?? 0;
      const budget: BudgetStatus | undefined = budgetMap.get(cat.name);

      return {
        ...cat,
        transactionCount: count,
        groupName: cat.parent?.name || cat.name,
        budgetedAmount: budget?.budgetedAmount,
        remainingAmount: budget?.remainingAmount,
        percentageUsed: budget?.percentageUsed
      } as CategoryBudgetGroup;
    });

    // Sort: Parent Group (alphabetical), then Child Name (alphabetical)
    return enriched.sort((a: CategoryBudgetGroup, b: CategoryBudgetGroup): number => {
      const groupCompare: number = a.groupName.localeCompare(b.groupName);
      if (groupCompare !== 0) return groupCompare;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Calculates the total number of transactions for a specific category group.
   * @param groupName - The name of the category group.
   */
  calculateGroupTotal(groupName: string): number {
    return this.categoryViewModels()
      .filter((c: CategoryBudgetGroup): boolean => c.groupName === groupName)
      .reduce((sum: number, c: CategoryBudgetGroup): number => sum + c.transactionCount, 0);
  }

  /**
   * Returns a user-friendly label for a PrimeIcon code.
   * @param iconCode - The pi- icon code.
   */
  getIconLabel(iconCode: string | undefined): string {
    if (!iconCode) return '';
    return iconCode
      .replace('pi-', '')
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Returns the color style for a category based on its percentage used.
   * @param percentage - The percentage of the budget used.
   */
  getColorStyle(percentage: number | undefined): string {
    if (percentage === undefined) return '';
    if (percentage < 80) return 'bg-emerald-500';
    if (percentage <= 100) return 'bg-amber-500';
    return 'bg-rose-500';
  }

  /**
   * Returns appropriate Tailwind classes for the progress bar based on utilization.
   * @param percentage - The percentage of the budget used.
   */
  getProgressBarTailwind(percentage: number | undefined): string {
    if (percentage === undefined) return '';
    if (percentage < 80) return '!bg-emerald-500';
    if (percentage <= 100) return '!bg-amber-500';
    return '!bg-rose-500';
  }

  /**
   * Opens the creation drawer.
   */
  openCreateDialog(): void {
    this.selectedCategory.set(null);
    this.showDialog.set(true);
  }

  /**
   * Opens the edit drawer for the selected category.
   * @param category - The category to edit.
   */
  openEditDialog(category: Category): void {
    this.selectedCategory.set(category);
    this.showDialog.set(true);
  }

  /**
   * Handles saving a category (create or update).
   * @param formData - The validated category data.
   */
  onSave(formData: CategoryCreateRequest | CategoryUpdateRequest): void {
    const existing: Category | null = this.selectedCategory();
    const operation: Observable<number> = existing
      ? this.categoryApi.updateCategory(existing.id, formData as CategoryUpdateRequest)
      : this.categoryApi.createCategory(formData as CategoryCreateRequest);

    this.loading.set(true);
    operation
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (): void => {
          this.toast.success(`Category ${existing ? 'updated' : 'created'} successfully`);
          this.showDialog.set(false);
          this.loadData();
        },
        error: (err: any): void => {
          console.error('Category operation failed:', err);
          this.toast.error(err.error?.detail || `Failed to ${existing ? 'update' : 'create'} category`);
        }
      });
  }

  /**
   * Deletes a category if it has no associated transactions.
   * @param category - The category to delete.
   */
  deleteCategory(category: Category): void {
    this.confirmationService.confirm({
      header: 'Delete Category?',
      message: `Are you sure you want to delete '${category.name}'?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: (): void => {
        this.categoryApi.deleteCategory(category.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (): void => {
              this.toast.success('Category deleted successfully');
              this.loadData();
            },
            error: (err: any): void => {
              console.error('Delete failed:', err);
              this.toast.error(err.error?.detail || 'Failed to delete category');
            }
          });
      }
    });
  }

  /**
   * Navigates to the transactions view filtered by this category.
   * @param category - The category to filter by.
   */
  viewTransactions(category: Category): void {
    this.router.navigate(['/transactions'], {
      queryParams: {category: category.name}
    });
  }
}
