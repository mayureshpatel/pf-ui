import { Component, EventEmitter, inject, input, OnChanges, Output, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { Select } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageModule } from 'primeng/message';
import { Category } from '@models/category.model';
import { BudgetApiService } from '../../services/budget-api.service';
import { ToastService } from '@core/services/toast.service';

@Component({
  selector: 'app-budget-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    Select,
    InputNumberModule,
    MessageModule
  ],
  templateUrl: './budget-form-dialog.component.html'
})
export class BudgetFormDialogComponent implements OnChanges {
  private readonly budgetApi = inject(BudgetApiService);
  private readonly toast = inject(ToastService);

  visible = input.required<boolean>();
  categories = input.required<Category[]>();
  month = input.required<number>();
  year = input.required<number>();

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() save = new EventEmitter<void>();

  selectedCategoryId: number | null = null;
  amount: number | null = null;
  loading: WritableSignal<boolean> = signal(false);
  errorMessage: WritableSignal<string | null> = signal(null);

  categoryOptions = signal<{ label: string, value: number }[]>([]);

  ngOnChanges(): void {
    if (this.visible()) {
      this.categoryOptions.set(
        this.categories().map(c => ({ label: c.name, value: c.id }))
      );
    }
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

    this.loading.set(true);
    this.budgetApi.setBudget({
      categoryId: this.selectedCategoryId,
      amount: this.amount,
      month: this.month(),
      year: this.year()
    }).subscribe({
      next: () => {
        this.toast.success('Budget updated successfully');
        this.save.emit();
        this.onHide();
      },
      error: (error) => {
        this.errorMessage.set(error.error?.detail || 'Failed to update budget');
        this.loading.set(false);
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
