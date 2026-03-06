import {Component, DestroyRef, inject, input, InputSignal, OnChanges, output, OutputEmitterRef, signal, WritableSignal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ReactiveFormsModule, FormGroup, FormControl, Validators} from '@angular/forms';
import {finalize} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {DialogModule} from 'primeng/dialog';
import {ButtonModule} from 'primeng/button';
import {Select, SelectModule} from 'primeng/select';
import {InputNumberModule} from 'primeng/inputnumber';
import {MessageModule} from 'primeng/message';
import {SelectItemGroup} from 'primeng/api';
import {Category} from '@models/category.model';
import {BudgetApiService} from '../../services/budget-api.service';
import {ToastService} from '@core/services/toast.service';

@Component({
  selector: 'app-budget-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
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

  form = new FormGroup({
    categoryId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    amount: new FormControl<number | null>(null, { validators: [Validators.required, Validators.min(0)] })
  });

  ngOnChanges(): void {
    if (this.visible()) {
      this.categoryGroups.set(this.groupCategories(this.categories()));
      this.form.reset();
      this.errorMessage.set(null);
    }
  }

  private groupCategories(categories: Category[]): SelectItemGroup[] {
    const parents: Category[] = [];
    const children: Category[] = [];

    categories.forEach((category: Category): void => {
      if (category.parent) {
        children.push(category);
      } else {
        parents.push(category);
      }
    });

    const groups: SelectItemGroup[] = [];

    if (parents.length > 0) {
      groups.push({
        label: 'Parent Categories',
        items: parents.map((p: Category) => ({ label: p.name, value: p.id }))
      });
    }

    parents.forEach((parentCategory: Category): void => {
      const childrenCategories = children.filter((c: Category) => c.parent?.id === parentCategory.id);
      if (childrenCategories.length > 0) {
        groups.push({
          label: parentCategory.name,
          items: childrenCategories.map((c: Category) => ({ label: c.name, value: c.id }))
        });
      }
    });

    return groups;
  }

  onHide(): void {
    this.visibleChange.emit(false);
    this.form.reset();
    this.errorMessage.set(null);
    this.loading.set(false);
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading()) return;

    const { categoryId, amount } = this.form.getRawValue();
    const selectedCategory = this.categories().find((c: Category) => c.id === categoryId);
    if (!selectedCategory) {
      this.errorMessage.set('Selected category does not exist');
      return;
    }

    this.loading.set(true);
    this.budgetApi.createBudget(categoryId!, amount!, this.month(), this.year())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.loading.set(false))
      )
      .subscribe({
        next: (_: number): void => {
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
}
