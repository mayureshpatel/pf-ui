import {Component, computed, inject, OnInit, OnDestroy, signal, WritableSignal, DestroyRef} from '@angular/core';
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
import {CategoryFormDialogComponent} from './components/category-form-dialog/category-form-dialog.component';
import {ToastService} from '@core/services/toast.service';
import {getCategoryColor} from '@shared/utils/category.utils';
import {formatCurrency} from '@shared/utils/account.utils';
import {ScreenToolbarComponent} from '@shared/components/screen-toolbar/screen-toolbar';

export interface CategoryViewModel extends CategoryWithUsage {
  groupName: string;
  budgetedAmount?: number;
  remainingAmount?: number;
  percentageUsed?: number;
}

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
    CategoryFormDialogComponent
  ],
  templateUrl: './categories.component.html'
})
export class CategoriesComponent implements OnInit, OnDestroy {
  private readonly categoryApi = inject(CategoryApiService);
  private readonly transactionApi = inject(TransactionApiService);
  private readonly budgetApi = inject(BudgetApiService);
  private readonly toast = inject(ToastService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  categories: WritableSignal<CategoryViewModel[]> = signal([]);
  loading: WritableSignal<boolean> = signal(false);
  showDialog: WritableSignal<boolean> = signal(false);
  selectedCategory: WritableSignal<Category | null> = signal(null);

  isEmpty = computed(() => this.categories().length === 0 && !this.loading());

  formatCurrency = formatCurrency;

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    // Clear signal holding enriched category data to allow garbage collection
    this.categories.set([]);
  }

  loadData(): void {
    this.loading.set(true);
    const now = new Date();

    forkJoin({
      categories: this.categoryApi.getCategories(),
      transactions: this.transactionApi.getTransactions({}, {page: 0, size: 1000}),
      budgets: this.budgetApi.getBudgetStatus(now.getMonth() + 1, now.getFullYear())
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({categories, transactions, budgets}) => {
          // Map budgets for quick lookup
          const budgetMap = new Map(budgets.map(b => [b.categoryName, b]));

          // Calculate usage and normalize parent names
          const enriched = categories.map(cat => {
            const count = transactions.content.filter(t => t.categoryName === cat.name).length;
            const budget = budgetMap.get(cat.name);

            return {
              ...cat,
              transactionCount: count,
              groupName: cat.parentName || cat.name,
              budgetedAmount: budget?.budgetedAmount,
              remainingAmount: budget?.remainingAmount,
              percentageUsed: budget?.percentageUsed
            } as CategoryViewModel;
          });

          // Sort by Group Name, then by Category Name
          enriched.sort((a, b) => {
            const groupCompare = a.groupName.localeCompare(b.groupName);
            if (groupCompare !== 0) return groupCompare;
            return a.name.localeCompare(b.name);
          });

          this.categories.set(enriched);
          this.loading.set(false);
        },
        error: () => {
          this.toast.error('Failed to load categories');
          this.loading.set(false);
        }
      });
  }

  calculateGroupTotal(groupName: string): number {
    return this.categories()
      .filter(c => c.parentName === groupName || c.name === groupName)
      .reduce((sum, c) => sum + c.transactionCount, 0);
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
      // Update existing category
      this.categoryApi.updateCategory(category.id, formData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (updated) => {
            this.toast.success('Category updated successfully');
            this.showDialog.set(false);
            this.loadData();
          },
          error: (error) => {
            this.toast.error(error.error?.detail || 'Failed to update category');
          }
        });
    } else {
      // Create new category
      this.categoryApi.createCategory(formData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (created) => {
            this.toast.success('Category created successfully');
            this.showDialog.set(false);
            this.loadData();
          },
          error: (error) => {
            this.toast.error(error.error?.detail || 'Failed to create category');
          }
        });
    }
  }
}
