import { Component, EventEmitter, input, OnChanges, Output, signal, WritableSignal, inject, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { RadioButtonModule } from 'primeng/radiobutton';
import { TooltipModule } from 'primeng/tooltip';
import { MessageModule } from 'primeng/message';
import { Category, CategoryFormData, CategoryType } from '@models/category.model';
import { getCategoryColor, CATEGORY_COLORS } from '@shared/utils/category.utils';
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
    Select,
    RadioButtonModule,
    TooltipModule,
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
    name: '',
    color: '',
    icon: '',
    type: CategoryType.EXPENSE,
    parentId: undefined
  };

  loading: WritableSignal<boolean> = signal(false);
  errorMessage: WritableSignal<string | null> = signal(null);
  allCategories: WritableSignal<Category[]> = signal([]);

  availableColors = CATEGORY_COLORS;
  getCategoryColor = getCategoryColor;

  iconOptions = [
    'pi-shopping-cart', 'pi-home', 'pi-car', 'pi-money-bill', 'pi-briefcase',
    'pi-heart', 'pi-bolt', 'pi-globe', 'pi-gift', 'pi-users',
    'pi-book', 'pi-desktop', 'pi-phone', 'pi-wrench', 'pi-shield',
    'pi-tag', 'pi-ticket', 'pi-wallet', 'pi-star', 'pi-key'
  ];

  typeOptions = [
    { label: 'Expense', value: CategoryType.EXPENSE },
    { label: 'Income', value: CategoryType.INCOME },
    { label: 'Both', value: CategoryType.BOTH }
  ];

  parentOptions = computed(() => {
    const currentId = this.category()?.id;
    return this.allCategories()
      .filter(c => c.id !== currentId) // Exclude self
      .map(c => ({ label: c.name, value: c.id }));
  });

  ngOnChanges(): void {
    const cat = this.category();
    if (cat) {
      this.formData = {
        name: cat.name,
        color: cat.color || getCategoryColor(cat.name),
        icon: cat.icon || '',
        type: cat.type || CategoryType.EXPENSE,
        parentId: cat.parentId
      };
    } else {
      this.resetForm();
    }

    // Load all categories for duplicate check & parent dropdown
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

  getIconLabel(iconCode: string): string {
    if (!iconCode) return '';
    return iconCode
      .replace('pi-', '')
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
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

    // Check for duplicate names within same parent only (case-insensitive)
    const currentCategory = this.category();
    const isDuplicate = this.allCategories().some(
      cat => cat.name.toLowerCase() === this.formData.name.trim().toLowerCase()
        && (cat.parentId ?? null) === (this.formData.parentId ?? null)  // Check same parent
        && (!currentCategory || cat.id !== currentCategory.id)
    );

    if (isDuplicate) {
      const parentContext = this.formData.parentId
        ? 'under the same parent category'
        : 'as a top-level category';
      this.errorMessage.set(`A category with this name already exists ${parentContext}`);
      return;
    }

    this.loading.set(true);
    
    // If no color selected (and not editing), use hash logic
    let colorToSave = this.formData.color;
    if (!colorToSave) {
      colorToSave = getCategoryColor(this.formData.name);
    }

    this.save.emit({ 
      name: this.formData.name.trim(),
      color: colorToSave,
      icon: this.formData.icon,
      type: this.formData.type,
      parentId: this.formData.parentId
    });
  }

  resetForm(): void {
    this.formData = {
      name: '',
      color: '',
      icon: '',
      type: CategoryType.EXPENSE,
      parentId: undefined
    };
    this.errorMessage.set(null);
    this.loading.set(false);
  }

  selectColor(color: string): void {
    this.formData.color = color;
  }

  selectIcon(icon: string): void {
    this.formData.icon = icon;
  }

  get isEditMode(): boolean {
    return this.category() !== null;
  }

  get dialogTitle(): string {
    return this.isEditMode ? 'Edit Category' : 'Create Category';
  }

  get previewColor(): string {
    if (this.formData.color) {
      return this.formData.color;
    }
    return this.formData.name ? getCategoryColor(this.formData.name) : 'bg-gray-300';
  }
}
