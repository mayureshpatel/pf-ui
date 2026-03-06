import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnDestroy,
  OnInit,
  Signal,
  signal,
  WritableSignal
} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {CommonModule} from '@angular/common';
import {Router} from '@angular/router';
import {ButtonModule} from 'primeng/button';
import {TableModule} from 'primeng/table';
import {ProgressBarModule} from 'primeng/progressbar';
import {CardModule} from 'primeng/card';
import {TooltipModule} from 'primeng/tooltip';
import {ConfirmationService} from 'primeng/api';
import {forkJoin} from 'rxjs';
import {Category, CategoryFormData, CategoryWithUsage} from '@models/category.model';
import {CategoryApiService} from './services/category-api.service';
import {TransactionApiService} from '@features/transactions/services/transaction-api.service';
import {BudgetApiService} from '@features/budgets/services/budget-api.service';
import {CategoryFormDrawerComponent} from './components/category-form-drawer/category-form-drawer.component';
import {ToastService} from '@core/services/toast.service';
import {getCategoryColor} from '@shared/utils/category.utils';
import {ScreenToolbarComponent} from '@shared/components/screen-toolbar/screen-toolbar';
import {FormatCurrencyPipe} from '@shared/pipes/format-currency.pipe';
import {BudgetStatus} from '@models/budget.model';
import {CategoryTransactionCount} from '@models/transaction.model';

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
export class CategoriesComponent implements OnInit, OnDestroy {
  // injected services
  private readonly categoryApi: CategoryApiService = inject(CategoryApiService);
  private readonly transactionApi: TransactionApiService = inject(TransactionApiService);
  private readonly budgetApi: BudgetApiService = inject(BudgetApiService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly confirmationService: ConfirmationService = inject(ConfirmationService);
  private readonly router: Router = inject(Router);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  // signals
  categoryViewModels: WritableSignal<CategoryViewModel[]> = signal([]);
  loading: WritableSignal<boolean> = signal(false);
  showDialog: WritableSignal<boolean> = signal(false);
  selectedCategory: WritableSignal<Category | null> = signal(null);

  // computed signals
  isEmpty: Signal<boolean> = computed((): boolean => this.categoryViewModels().length === 0 && !this.loading());

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.categoryViewModels.set([]);
  }

  loadData(): void {
    this.loading.set(true);
    const now = new Date();

    forkJoin({
      categories: this.categoryApi.getCategories(),
      transactionCategoryCount: this.transactionApi.getCountsByCategory(),
      budgets: this.budgetApi.getBudgetStatus(now.getMonth() + 1, now.getFullYear())
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({categories, transactionCategoryCount, budgets}) => {
          const budgetMap = new Map(budgets.map((budgetStatus: BudgetStatus) => [budgetStatus.category.name, budgetStatus]));

          // calculate usage and normalize parent names
          const enriched: CategoryViewModel[] = categories.map((category: Category): CategoryViewModel => {
            const transactionCount: number = transactionCategoryCount
              .find((transactionCategoryCount: CategoryTransactionCount): boolean => transactionCategoryCount.category.id === category.id)
              ?.transactionCount ?? 0;
            const budget: BudgetStatus | undefined = budgetMap.get(category.name);

            return {
              ...category,
              transactionCount: transactionCount,
              groupName: category.parent?.name || category.name,
              budgetedAmount: budget?.budgetedAmount,
              remainingAmount: budget?.remainingAmount,
              percentageUsed: budget?.percentageUsed
            } as CategoryViewModel;
          });

          // sort by Group Name, then by category Name
          enriched.sort((a: CategoryViewModel, b: CategoryViewModel): number => {
            const groupCompare: number = a.groupName.localeCompare(b.groupName);
            if (groupCompare !== 0) {
              return groupCompare;
            }

            return a.name.localeCompare(b.name);
          });

          this.categoryViewModels.set(enriched);
          this.loading.set(false);
        },
        error: () => {
          this.toast.error('Failed to load categories');
          this.loading.set(false);
        }
      });
  }

  calculateGroupTotal(groupName: string): number {
    return this.categoryViewModels()
      .filter((c: CategoryViewModel): boolean => c.parent?.name === groupName || c.name === groupName)
      .reduce((sum: number, c: CategoryViewModel): number => sum + c.transactionCount, 0);
  }

  getDisplayColor(category: Category): string {
    return category.color || getCategoryColor(category.name);
  }

  getIconLabel(iconCode: string | undefined): string {
    if (!iconCode) return '';
    return iconCode
      .replace('pi-', '')
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  getProgressBarTailwind(percentage: number | undefined): string {
    if (percentage === undefined) return '';
    if (percentage < 80) return '!bg-green-500';
    if (percentage <= 100) return '!bg-yellow-500';
    return '!bg-red-500';
  }

  openCreateDialog(): void {
    this.selectedCategory.set(null);
    this.showDialog.set(true);
  }

  openEditDialog(category: Category): void {
    this.selectedCategory.set(category);
    this.showDialog.set(true);
  }

  deleteCategory(category: Category): void {
    this.confirmationService.confirm({
      header: 'Delete Category?',
      message: `Are you sure you want to delete '${category.name}'?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.categoryApi.deleteCategory(category.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.toast.success('Category deleted successfully');
              this.loadData();
            },
            error: (error) => {
              this.toast.error(error.error?.detail || 'Failed to delete category');
            }
          });
      }
    });
  }

  viewTransactions(category: Category): void {
    this.router.navigate(['/transactions'], {
      queryParams: {category: category.name}
    });
  }

  onSave(formData: CategoryFormData): void {
    const category = this.selectedCategory();

    if (category) {
      // Update the existing category
      this.categoryApi.updateCategory(category.id, formData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (_: number): void => {
            this.toast.success('Category updated successfully');
            this.showDialog.set(false);
            this.loadData();
          },
          error: (error: any): void => {
            console.error('Error updating category:', error);
            this.toast.error(error.error?.detail || 'Failed to update category');
          }
        });
    } else {
      // Create a new category
      this.categoryApi.createCategory(formData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (_: number): void => {
            this.toast.success('Category created successfully');
            this.showDialog.set(false);
            this.loadData();
          },
          error: (error: any): void => {
            console.error('Error creating category:', error);
            this.toast.error(error.error?.detail || 'Failed to create category');
          }
        });
    }
  }
}
