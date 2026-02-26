import {
  Component,
  computed,
  inject,
  input,
  InputSignal,
  model,
  ModelSignal,
  OnChanges,
  output,
  OutputEmitterRef,
  signal,
  WritableSignal
} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {ButtonModule} from 'primeng/button';
import {InputTextModule} from 'primeng/inputtext';
import {Select} from 'primeng/select';
import {RadioButtonModule} from 'primeng/radiobutton';
import {TooltipModule} from 'primeng/tooltip';
import {MessageModule} from 'primeng/message';
import {Category, CategoryType} from '@models/category.model';
import {CATEGORY_COLORS, getCategoryColor} from '@shared/utils/category.utils';
import {CategoryApiService} from '../../services/category-api.service';
import {DrawerComponent} from '@shared/components/drawer/drawer.component';

@Component({
  selector: 'app-category-form-drawer',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    Select,
    RadioButtonModule,
    TooltipModule,
    MessageModule,
    DrawerComponent
  ],
  templateUrl: './category-form-drawer.component.html'
})
export class CategoryFormDrawerComponent implements OnChanges {
  // injected services
  private readonly categoryApi: CategoryApiService = inject(CategoryApiService);

  // input signals
  visible: ModelSignal<boolean> = model.required<boolean>();
  category: InputSignal<Category | null> = input<Category | null>(null);
  saving: InputSignal<boolean> = input<boolean>(false);

  // output signals
  save: OutputEmitterRef<any> = output<any>();

  formData = {
    name: '',
    color: '',
    icon: '',
    type: undefined as CategoryType | undefined,
    parentId: undefined as number | undefined
  };

  // signals
  errorMessage: WritableSignal<string | null> = signal(null);
  allCategories: WritableSignal<Category[]> = signal([]);

  availableColors: string[] = CATEGORY_COLORS;

  iconOptions: string[] = [
    'pi-shopping-cart', 'pi-home', 'pi-car', 'pi-money-bill', 'pi-briefcase',
    'pi-heart', 'pi-bolt', 'pi-globe', 'pi-gift', 'pi-users',
    'pi-book', 'pi-desktop', 'pi-phone', 'pi-wrench', 'pi-shield',
    'pi-tag', 'pi-ticket', 'pi-wallet', 'pi-star', 'pi-key'
  ];

  typeOptions = [
    {label: 'Expense', value: CategoryType.EXPENSE},
    {label: 'Income', value: CategoryType.INCOME},
    {label: 'Both', value: CategoryType.BOTH}
  ];

  parentOptions = computed(() => {
    const currentId: number | undefined = this.category()?.id;

    return this.allCategories()
      .filter((category: Category): boolean => category.id !== currentId && !category.parent)
      .map((category: Category) => ({label: category.name, value: category.id}));
  });

  ngOnChanges(): void {
    const category: Category | null = this.category();

    if (category) {
      this.formData = {
        name: category.name,
        color: category.iconography.color || getCategoryColor(category.name),
        icon: category.iconography.icon || '',
        type: category.type || CategoryType.EXPENSE,
        parentId: category.parent.id
      };
    } else {
      this.resetForm();
    }

    // load all categories for duplicate check & parent dropdown
    if (this.visible()) {
      this.loadCategories();
    }
  }

  loadCategories(): void {
    this.categoryApi.getCategories().subscribe({
      next: (categories: Category[]): void => this.allCategories.set(categories),
      error: (): void => {
      }
    });
  }

  onHide(): void {
    setTimeout((): void => {
      this.resetForm();
    }, 300);
  }

  getIconLabel(iconCode: string): string {
    if (!iconCode) return '';
    return iconCode
      .replace('pi-', '')
      .split('-')
      .map((word: string): string => word.charAt(0).toUpperCase() + word.slice(1))
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

    // check for duplicate names within the same parent only
    const currentCategory: Category | null = this.category();

    const isDuplicate: boolean = this.allCategories().some(
      (category: Category): boolean => category.name.toLowerCase() === this.formData.name.trim().toLowerCase()
        && (category.parent.id ?? null) === (this.formData.parentId ?? null)
        && (category.id !== currentCategory?.id)
    );

    if (isDuplicate) {
      const parentContext = this.formData.parentId
        ? 'under the same parent category'
        : 'as a top-level category';
      this.errorMessage.set(`A category with this name already exists ${parentContext}`);
      return;
    }

    // if no color selected, use hash logic
    let colorToSave: string = this.formData.color;
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
      type: undefined,
      parentId: undefined
    };
    this.errorMessage.set(null);
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

  get drawerTitle(): string {
    return this.isEditMode ? 'Edit Category' : 'Create Category';
  }

  get drawerIcon(): string {
    return this.isEditMode ? 'pi-tag' : 'pi-plus';
  }

  get previewColor(): string {
    if (this.formData.color) {
      return this.formData.color;
    }
    return this.formData.name ? getCategoryColor(this.formData.name) : 'bg-gray-300';
  }
}
