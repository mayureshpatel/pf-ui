import { Component, computed, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService } from 'primeng/api';
import { forkJoin } from 'rxjs';
import { Category, CategoryFormData, CategoryWithUsage } from '@models/category.model';
import { CategoryApiService } from './services/category-api.service';
import { TransactionApiService } from '@features/transactions/services/transaction-api.service';
import { CategoryFormDialogComponent } from './components/category-form-dialog/category-form-dialog.component';
import { ToastService } from '@core/services/toast.service';
import { getCategoryColor } from '@shared/utils/category.utils';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TableModule,
    CardModule,
    ConfirmDialogModule,
    TooltipModule,
    CategoryFormDialogComponent
  ],
  providers: [ConfirmationService],
  templateUrl: './categories.component.html'
})
export class CategoriesComponent implements OnInit {
  private readonly categoryApi = inject(CategoryApiService);
  private readonly transactionApi = inject(TransactionApiService);
  private readonly toast = inject(ToastService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly router = inject(Router);

  categories: WritableSignal<Category[]> = signal([]);
  transactions: WritableSignal<any[]> = signal([]);
  loading: WritableSignal<boolean> = signal(false);
  showDialog: WritableSignal<boolean> = signal(false);
  selectedCategory: WritableSignal<Category | null> = signal(null);

  categoriesWithUsage = computed(() => {
    const cats = this.categories();
    const txns = this.transactions();

    return cats.map(cat => {
      const count = txns.filter(t => t.categoryName === cat.name).length;
      return {
        ...cat,
        transactionCount: count
      } as CategoryWithUsage;
    }).sort((a, b) => a.name.localeCompare(b.name));
  });

  isEmpty = computed(() => this.categories().length === 0 && !this.loading());

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);

    forkJoin({
      categories: this.categoryApi.getCategories(),
      transactions: this.transactionApi.getTransactions({}, { page: 0, size: 10000 })
    }).subscribe({
      next: ({ categories, transactions }) => {
        this.categories.set(categories);
        this.transactions.set(transactions.content);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Failed to load categories');
        this.loading.set(false);
      }
    });
  }

  getDisplayColor(category: Category): string {
    return category.color || getCategoryColor(category.name);
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
        this.categoryApi.deleteCategory(category.id).subscribe({
          next: () => {
            this.toast.success('Category deleted successfully');
            this.categories.update(cats => cats.filter(c => c.id !== category.id));
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
      queryParams: { category: category.name } 
    });
  }

  onSave(formData: CategoryFormData): void {
    const category = this.selectedCategory();

    if (category) {
      // Update existing category
      this.categoryApi.updateCategory(category.id, formData).subscribe({
        next: (updated) => {
          this.categories.update(cats => 
            cats.map(c => c.id === category.id ? updated : c)
          );
          this.toast.success('Category updated successfully');
          this.showDialog.set(false);
        },
        error: (error) => {
          this.toast.error(error.error?.detail || 'Failed to update category');
        }
      });
    } else {
      // Create new category
      this.categoryApi.createCategory(formData).subscribe({
        next: (created) => {
          this.categories.update(cats => [...cats, created]);
          this.toast.success('Category created successfully');
          this.showDialog.set(false);
        },
        error: (error) => {
          this.toast.error(error.error?.detail || 'Failed to create category');
        }
      });
    }
  }
}
