import {
  Component,
  DestroyRef,
  inject,
  input,
  InputSignal,
  OnChanges,
  output,
  OutputEmitterRef,
  signal,
  WritableSignal
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {DialogModule} from 'primeng/dialog';
import {ButtonModule} from 'primeng/button';
import {Select, SelectModule} from 'primeng/select';
import {InputNumberModule} from 'primeng/inputnumber';
import {MessageModule} from 'primeng/message';
import {SelectItemGroup} from 'primeng/api';
import {Category} from '@models/category.model';
import {Budget} from '@models/budget.model';
import {BudgetApiService} from '../../services/budget-api.service';
import {ToastService} from '@core/services/toast.service';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {finalize} from 'rxjs';

@Component({
  selector: 'app-budget-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    Select,
    SelectModule,
    InputNumberModule,
    MessageModule
  ],
  templateUrl: './budget-form-dialog.component.html'
})
export class BudgetFormDialogComponent implements OnChanges {
  // injected services
  private readonly budgetApi = inject(BudgetApiService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  // input signals
  visible: InputSignal<boolean> = input.required<boolean>();
  categories: InputSignal<Category[]> = input.required<Category[]>();
  month: InputSignal<number> = input.required<number>();
  year: InputSignal<number> = input.required<number>();

  // output signals
  visibleChange: OutputEmitterRef<boolean> = output<boolean>();
  save: OutputEmitterRef<void> = output<void>();

  // signals
  loading: WritableSignal<boolean> = signal(false);
  errorMessage: WritableSignal<string | null> = signal(null);
  categoryGroups: WritableSignal<SelectItemGroup[]> = signal<SelectItemGroup[]>([]);

  selectedCategoryId: number | null = null;
  amount: number | null = null;

  ngOnChanges(): void {
    if (this.visible()) {
      this.categoryGroups.set(this.groupCategories(this.categories()));
    }
  }

  private groupCategories(categories: Category[]): SelectItemGroup[] {
    // group categories by parent
    let parents: Category[] = [];
    let children: Category[] = [];

    categories.forEach((category: Category): void => {
      if (!category.parent) {
        parents.push(category);
      } else {
        children.push(category);
      }
    })

    const groups: SelectItemGroup[] = [];

    // Add parent categories as their own group
    if (parents.length > 0) {
      groups.push({
        label: 'Parent Categories',
        items: parents.map((parentCategory: Category) => ({
          label: parentCategory.name,
          value: parentCategory.id
        }))
      });
    }

    // add children grouped by parent
    parents.forEach((parentCategory: Category): void => {
      const childrenCategories: Category[] = children.filter((childCategory: Category): boolean => childCategory.parent.id === parentCategory.id);

      if (childrenCategories.length > 0) {
        groups.push({
          label: parentCategory.name,
          items: childrenCategories.map((childCategory: Category) => ({
            label: childCategory.name,
            value: childCategory.id
          }))
        });
      }
    });

    return groups;
  }

  onHide(): void {
    this.visibleChange.emit(false);
    this.resetForm();
  }

  onSubmit(): void {
    if (!this.selectedCategoryId || this.amount === null) {
      this.errorMessage.set('Please select a category and amount');
      return;
    }

    let selectedCategory: Category | undefined = this.categories().find((category: Category): boolean => category.id === this.selectedCategoryId);
    if (!selectedCategory) {
      this.errorMessage.set('Selected category does not exist');
      return;
    }

    this.loading.set(true);
    this.budgetApi.setBudget({
      category: selectedCategory,
      amount: this.amount,
      month: this.month(),
      year: this.year()
    } as Budget)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => {
          this.loading.set(false);
        })
      )
      .subscribe({
        next: (): void => {
          this.toast.success('Budget updated successfully');
          this.save.emit();
          this.onHide();
        },
        error: (error: any): void => {
          console.error('Error updating budget:', error);
          this.errorMessage.set(error.error?.detail || 'Failed to update budget');
        }
      });
  }

  resetForm(): void {
    this.selectedCategoryId = null;
    this.amount = null;
    this.errorMessage.set(null);
    this.loading.set(false);
  }
}
