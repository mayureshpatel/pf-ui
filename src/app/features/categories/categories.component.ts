import {Component, computed, DestroyRef, inject, OnInit, Signal, signal, WritableSignal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {CommonModule} from '@angular/common';
import {Router, RouterLink} from '@angular/router';
import {finalize, forkJoin, Observable} from 'rxjs';
import {ButtonModule} from 'primeng/button';
import {TableModule} from 'primeng/table';
import {ProgressBarModule} from 'primeng/progressbar';
import {CardModule} from 'primeng/card';
import {TooltipModule} from 'primeng/tooltip';
import {ConfirmationService} from 'primeng/api';
import {CategoryApiService} from './services/category-api.service';
import {TransactionApiService} from '@features/transactions/services/transaction-api.service';
import {CategoryFormDrawerComponent} from './components/category-form-drawer/category-form-drawer.component';
import {ToastService} from '@core/services/toast.service';
import {ScreenToolbarComponent} from '@shared/components/screen-toolbar/screen-toolbar';
import {Category, CategoryCreateRequest, CategoryGroup, CategoryUpdateRequest} from '@models/category.model';

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
    RouterLink
  ],
  templateUrl: './categories.component.html'
})
export class CategoriesComponent implements OnInit {
  private readonly categoryApi: CategoryApiService = inject(CategoryApiService);
  private readonly transactionApi: TransactionApiService = inject(TransactionApiService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly confirmationService: ConfirmationService = inject(ConfirmationService);
  private readonly router: Router = inject(Router);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /** The enriched and grouped list of categories. */
  readonly categories: WritableSignal<CategoryGroup[]> = signal([]);

  /** Flattened list of all categories for the form drawer. */
  readonly allCategories: Signal<Category[]> = computed(() =>
    this.categories().flatMap(g => [g.parent, ...g.items])
  );

  /**
   * Flattened list of categories specifically for the PrimeNG table.
   * Ensures every row has a parent reference for subheader grouping.
   */
  readonly tableData: Signal<Category[]> = computed(() => {
    const data: Category[] = [];
    this.categories().forEach(group => {
      if (group.items.length > 0) {
        group.items.forEach(item => data.push({...item, parent: group.parent}));
      } else {
        data.push({...group.parent, parent: group.parent});
      }
    });
    return data;
  });

  /** Global loading state for API operations. */
  readonly loading: WritableSignal<boolean> = signal(false);

  /** Visibility of the category creation/edit drawer. */
  readonly showDialog: WritableSignal<boolean> = signal(false);

  /** The category currently selected for editing. */
  readonly selectedCategory: WritableSignal<Category | null> = signal(null);

  /** Indicates if there are no categories to display. */
  readonly isEmpty: Signal<boolean> = computed((): boolean =>
    this.categories().length === 0 && !this.loading()
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

    forkJoin({
      categories: this.categoryApi.getCategories(),
      transactionCounts: this.transactionApi.getCountsByCategory()
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.loading.set(false))
      )
      .subscribe({
        next: ({categories, transactionCounts}): void => {
          this.categories.set(this.enrichCategories(categories, transactionCounts));
        },
        error: (err: any): void => {
          console.error('Failed to load category data:', err);
          this.toast.error('Failed to load categories');
        }
      });
  }

  private enrichCategories(categories: Category[], transactionCounts: Category[]): CategoryGroup[] {
    const countsMap = new Map<number, number>(
      transactionCounts.map(c => [c.id, c.transactionCount || 0])
    );

    const enriched = categories.map(c => ({
      ...c,
      transactionCount: countsMap.get(c.id) || 0
    }));

    const parents = enriched.filter(c => !c.parent);
    const children = enriched.filter(c => !!c.parent);

    const groups: CategoryGroup[] = parents.map(p => {
      const groupItems = children.filter(c => c.parent?.id === p.id);
      const totalCount: number = p.transactionCount + groupItems.reduce((sum, c): number => sum + (c.transactionCount || 0), 0);
      const parentWithTotal = {...p, transactionCount: totalCount};

      return {
        parent: parentWithTotal,
        items: groupItems.sort((a, b) => a.name.localeCompare(b.name))
      };
    });

    return groups.sort((a, b) => a.parent.name.localeCompare(b.parent.name));
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
