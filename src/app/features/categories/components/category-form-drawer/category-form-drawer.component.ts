import {Component, computed, inject, input, InputSignal, model, ModelSignal, OnChanges, output, OutputEmitterRef, signal, WritableSignal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ReactiveFormsModule, FormGroup, FormControl, Validators} from '@angular/forms';
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
    ReactiveFormsModule,
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
  private readonly categoryApi: CategoryApiService = inject(CategoryApiService);

  // input signals
  visible: ModelSignal<boolean> = model.required<boolean>();
  category: InputSignal<Category | null> = input<Category | null>(null);
  saving: InputSignal<boolean> = input<boolean>(false);

  // output signals
  save: OutputEmitterRef<any> = output<any>();

  form = new FormGroup({
    name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(50)] }),
    color: new FormControl<string>('', { nonNullable: true }),
    icon: new FormControl<string>('', { nonNullable: true }),
    type: new FormControl<CategoryType | null>(null),
    parentId: new FormControl<number | null>(null)
  });

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
    { label: 'Expense', value: CategoryType.EXPENSE },
    { label: 'Income', value: CategoryType.INCOME },
    { label: 'Both', value: CategoryType.BOTH }
  ];

  parentOptions = computed(() => {
    const currentId = this.category()?.id;
    return this.allCategories()
      .filter((c: Category): boolean => c.id !== currentId && !c.parent)
      .map((c: Category) => ({ label: c.name, value: c.id }));
  });

  get previewColor(): string {
    const color = this.form.value.color;
    if (color) return color;
    const name = this.form.value.name;
    return name ? getCategoryColor(name) : 'bg-gray-300';
  }

  ngOnChanges(): void {
    const category = this.category();
    if (category) {
      this.form.patchValue({
        name: category.name,
        color: category.color || getCategoryColor(category.name),
        icon: category.icon || '',
        type: category.categoryType || CategoryType.EXPENSE,
        parentId: category.parent?.id ?? null
      });
    } else {
      this.form.reset({ name: '', color: '', icon: '', type: null, parentId: null });
    }
    this.errorMessage.set(null);

    if (this.visible()) {
      this.loadCategories();
    }
  }

  loadCategories(): void {
    this.categoryApi.getCategories().subscribe({
      next: (categories: Category[]): void => this.allCategories.set(categories),
      error: (): void => {}
    });
  }

  onHide(): void {
    setTimeout((): void => {
      this.form.reset({ name: '', color: '', icon: '', type: null, parentId: null });
      this.errorMessage.set(null);
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
    this.form.markAllAsTouched();
    this.errorMessage.set(null);

    if (this.form.invalid) return;

    const { name, color, icon, type, parentId } = this.form.getRawValue();
    const trimmedName = name.trim();

    if (!trimmedName) {
      this.errorMessage.set('Please enter a category name');
      return;
    }

    const currentCategory = this.category();
    const isDuplicate = this.allCategories().some(
      (c: Category): boolean =>
        c.name.toLowerCase() === trimmedName.toLowerCase() &&
        (c.parent?.id ?? null) === (parentId ?? null) &&
        c.id !== currentCategory?.id
    );

    if (isDuplicate) {
      const parentContext = parentId ? 'under the same parent category' : 'as a top-level category';
      this.errorMessage.set(`A category with this name already exists ${parentContext}`);
      return;
    }

    const colorToSave = color || getCategoryColor(trimmedName);

    this.save.emit({ name: trimmedName, color: colorToSave, icon, type, parentId });
  }

  selectColor(color: string): void {
    this.form.patchValue({ color });
  }

  selectIcon(icon: string): void {
    this.form.patchValue({ icon });
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
}
