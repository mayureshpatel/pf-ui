import { Component, EventEmitter, input, OnChanges, Output, signal, WritableSignal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { Category, CategoryFormData } from '@models/category.model';
import { getCategoryColor } from '@shared/utils/category.utils';
import { CategoryApiService } from '../../services/category-api.service';

@Component({
  selector: 'app-category-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    MessageModule
  ],
  templateUrl: './category-form-dialog.component.html'
})
export class CategoryFormDialogComponent implements OnChanges {
  private readonly categoryApi = inject(CategoryApiService);

  visible = input.required<boolean>();
  category = input<Category | null>(null);

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() save = new EventEmitter<CategoryFormData>();

  formData: CategoryFormData = {
    name: ''
  };

  loading: WritableSignal<boolean> = signal(false);
  errorMessage: WritableSignal<string | null> = signal(null);
  allCategories: WritableSignal<Category[]> = signal([]);

  getCategoryColor = getCategoryColor;

  ngOnChanges(): void {
    const cat = this.category();
    if (cat) {
      this.formData = {
        name: cat.name
      };
    } else {
      this.resetForm();
    }

    // Load all categories for duplicate check
    if (this.visible()) {
      this.loadCategories();
    }
  }

  loadCategories(): void {
    this.categoryApi.getCategories().subscribe({
      next: (categories) => this.allCategories.set(categories),
      error: () => {} // Ignore errors for duplicate check
    });
  }

  onHide(): void {
    this.visibleChange.emit(false);
    this.resetForm();
  }

  onSubmit(): void {
    this.errorMessage.set(null);

    if (!this.formData.name || this.formData.name.trim().length === 0) {
      this.errorMessage.set('Please enter a category name');
      return;
    }

    if (this.formData.name.length > 50) {
      this.errorMessage.set('Category name must be 50 characters or less');
      return;
    }

    // Check for duplicate names (case-insensitive)
    const currentCategory = this.category();
    const isDuplicate = this.allCategories().some(
      cat => cat.name.toLowerCase() === this.formData.name.trim().toLowerCase()
        && (!currentCategory || cat.id !== currentCategory.id)
    );

    if (isDuplicate) {
      this.errorMessage.set('A category with this name already exists');
      return;
    }

    this.loading.set(true);
    this.save.emit({ name: this.formData.name.trim() });
  }

  resetForm(): void {
    this.formData = {
      name: ''
    };
    this.errorMessage.set(null);
    this.loading.set(false);
  }

  get isEditMode(): boolean {
    return this.category() !== null;
  }

  get dialogTitle(): string {
    return this.isEditMode ? 'Edit Category' : 'Create Category';
  }

  get previewColor(): string {
    return this.formData.name ? getCategoryColor(this.formData.name) : 'bg-gray-300';
  }
}
