import { Component, inject, input, OnChanges, output, signal, WritableSignal, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { MessageModule } from 'primeng/message';
import { CategoryRuleDto } from '@models/category-rule.model';
import { CategoryRuleApiService } from '../../services/category-rule-api.service';
import { CategoryApiService } from '@features/categories/services/category-api.service';
import { ToastService } from '@core/services/toast.service';
import { CategoryGroup } from '@models/category.model';

@Component({
  selector: 'app-category-rule-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    MessageModule
  ],
  templateUrl: './category-rule-form-dialog.component.html'
})
export class CategoryRuleFormDialogComponent implements OnChanges {
  private readonly api = inject(CategoryRuleApiService);
  private readonly categoryApi = inject(CategoryApiService);
  private readonly toast = inject(ToastService);

  visible = input.required<boolean>();

  visibleChange = output<boolean>();
  save = output<void>();

  formData: CategoryRuleDto = {
    keyword: '',
    categoryName: '',
    priority: 0
  };

  categoryGroups: WritableSignal<CategoryGroup[]> = signal([]);
  loading: WritableSignal<boolean> = signal(false);
  errorMessage: WritableSignal<string | null> = signal(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible()) {
      this.resetForm();
      this.loadCategories();
    }
  }

  loadCategories(): void {
    this.categoryApi.getGroupedCategories().subscribe({
      next: (groups) => this.categoryGroups.set(groups),
      error: () => this.toast.error('Failed to load categories')
    });
  }

  onHide(): void {
    this.visibleChange.emit(false);
    this.resetForm();
  }

  onSubmit(): void {
    if (!this.formData.keyword || !this.formData.categoryName) {
      this.errorMessage.set('Keyword and Category are required');
      return;
    }

    this.loading.set(true);
    this.api.createRule(this.formData).subscribe({
      next: () => {
        this.toast.success('Rule created successfully');
        this.save.emit();
        this.onHide();
      },
      error: (error) => {
        this.errorMessage.set(error.error?.detail || 'Failed to create rule');
        this.loading.set(false);
      }
    });
  }

  resetForm(): void {
    this.formData = { keyword: '', categoryName: '', priority: 0 };
    this.errorMessage.set(null);
    this.loading.set(false);
  }
}
