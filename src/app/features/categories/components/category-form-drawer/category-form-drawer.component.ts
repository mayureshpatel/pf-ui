import {
  Component,
  computed,
  input,
  InputSignal,
  model,
  ModelSignal,
  output,
  OutputEmitterRef,
  signal,
  Signal,
  WritableSignal
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ButtonModule} from 'primeng/button';
import {InputTextModule} from 'primeng/inputtext';
import {SelectModule} from 'primeng/select';
import {RadioButtonModule} from 'primeng/radiobutton';
import {TooltipModule} from 'primeng/tooltip';
import {MessageModule} from 'primeng/message';

import {Category, CategoryCreateRequest, CategoryType, CategoryUpdateRequest} from '@models/category.model';
import {CATEGORY_COLORS, getCategoryColor} from '@shared/utils/category.utils';
import {DrawerComponent} from '@shared/components/drawer/drawer.component';

/**
 * Drawer component for creating and editing transaction categories.
 *
 * Features visual color and icon pickers, parent category grouping,
 * and a live preview of the category appearance.
 */
@Component({
  selector: 'app-category-form-drawer',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    RadioButtonModule,
    TooltipModule,
    MessageModule,
    DrawerComponent
  ],
  templateUrl: './category-form-drawer.component.html'
})
export class CategoryFormDrawerComponent {
  /** Indicates if the drawer is currently visible. */
  readonly visible: ModelSignal<boolean> = model.required<boolean>();

  /** List of all categories for parent selection and validation. */
  readonly categoryOptions: InputSignal<Category[]> = input.required<Category[]>();

  /** The category being edited, or null for creation mode. */
  readonly category: InputSignal<Category | null> = input<Category | null>(null);

  /** Indicates if a save operation is in flight. */
  readonly saving: InputSignal<boolean> = input(false);

  /** Emitted when the category data is successfully validated and ready to save. */
  readonly save: OutputEmitterRef<CategoryCreateRequest | CategoryUpdateRequest> = output<CategoryCreateRequest | CategoryUpdateRequest>();

  /** Holds API or validation error messages. */
  readonly errorMessage: WritableSignal<string | null> = signal<string | null>(null);

  /** List of colors to use for categories. */
  readonly availableColors: string[] = CATEGORY_COLORS;

  /** Optional icons to give to categories. */
  readonly iconOptions: string[] = [
    'pi-shopping-cart', 'pi-home', 'pi-car', 'pi-money-bill', 'pi-briefcase',
    'pi-heart', 'pi-bolt', 'pi-globe', 'pi-gift', 'pi-users',
    'pi-book', 'pi-desktop', 'pi-phone', 'pi-wrench', 'pi-shield',
    'pi-tag', 'pi-ticket', 'pi-wallet', 'pi-star', 'pi-key'
  ];

  /** Options for category classification. */
  readonly typeOptions = [
    {label: 'Expense', value: CategoryType.EXPENSE},
    {label: 'Income', value: CategoryType.INCOME},
    {label: 'Both', value: CategoryType.BOTH}
  ];

  /**
   * The reactive form group for category details.
   */
  readonly form = new FormGroup({
    id: new FormControl<number | null>({value: null, disabled: true}),
    name: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(50)]
    }),
    color: new FormControl<string>(''),
    icon: new FormControl<string>(''),
    type: new FormControl<CategoryType>(CategoryType.EXPENSE, {nonNullable: true}),
    parentId: new FormControl<number | null>(null)
  });

  /** Indicates if the component is in edit mode. */
  readonly isEditMode: Signal<boolean> = computed((): boolean => this.category() !== null);

  /** Title displayed in the drawer header. */
  readonly drawerTitle: Signal<string> = computed((): string => this.isEditMode() ? 'Edit Category' : 'Create Category');

  /** Icon displayed in the drawer header. */
  readonly drawerIcon: Signal<string> = computed((): string => this.isEditMode() ? 'pi-tag' : 'pi-plus');

  /**
   * Options for selecting a parent category.
   * Filters out the current category to prevent self-parenting loops.
   */
  readonly parentOptions: Signal<{ label: string, value: number }[]> = computed(() => {
    const currentId: number | undefined = this.category()?.id;

    return this.categoryOptions()
      .filter((c: Category): boolean => c.id !== currentId && !c.parent)
      .map((c: Category) => ({label: c.name, value: c.id}));
  });

  /**
   * Real-time preview color based on user selection or auto-generation.
   */
  readonly previewColor: Signal<string> = computed((): string => {
    const selectedColor: string | null = this.form.controls.color.value;
    if (selectedColor) {
      return selectedColor;
    }

    const name: string | undefined = this.form.value.name;
    return name ? getCategoryColor(name) : 'bg-surface-300';
  });

  onShow(): void {
    this.form.reset();
    this.errorMessage.set(null);

    const category: Category | null = this.category();

    if (category) {
      this.form.patchValue({
        id: category.id,
        name: category.name,
        color: category.color || getCategoryColor(category.name),
        icon: category.icon || '',
        type: category.type || CategoryType.EXPENSE,
        parentId: category.parent?.id ?? null
      });
    } else {
      this.form.patchValue({
        id: null,
        name: '',
        color: '',
        icon: '',
        type: CategoryType.EXPENSE,
        parentId: null
      });
    }
  }

  /**
   * Validates and submits the category form.
   */
  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const rawValue = this.form.getRawValue();
    const trimmedName: string = rawValue.name.trim();
    const selectedCategory: Category | null = this.category();

    if (!trimmedName) {
      this.errorMessage.set('Category name is required.');
      return;
    }

    const isDuplicate: boolean = this.categoryOptions().some((c: Category): boolean =>
      c.name.toLowerCase() === trimmedName.toLowerCase() &&
      (c.parent?.id ?? null) === (rawValue.parentId ?? null) &&
      c.id !== selectedCategory?.id
    );

    if (isDuplicate) {
      const context: string = rawValue.parentId ? 'under the same parent' : 'as a top-level category';
      this.errorMessage.set(`A category with this name already exists ${context}.`);
      return;
    }

    if (selectedCategory) {
      const updateRequest: CategoryUpdateRequest = {
        id: selectedCategory.id,
        name: trimmedName,
        type: rawValue.type,
        color: rawValue.color ?? getCategoryColor(trimmedName),
        icon: rawValue.icon ?? undefined,
        parentId: rawValue.parentId ?? undefined
      };
      this.save.emit(updateRequest);
    } else {
      const createRequest: CategoryCreateRequest = {
        name: trimmedName,
        type: rawValue.type,
        color: rawValue.color || getCategoryColor(trimmedName),
        icon: rawValue.icon ?? undefined,
        parentId: rawValue.parentId ?? undefined
      };
      this.save.emit(createRequest);
    }
  }

  /**
   * Direct selection handler for the color picker grid.
   * @param color - The hex color code.
   */
  selectColor(color: string): void {
    if (this.form.controls.color.value === color) {
      this.form.controls.color.setValue('');
      return;
    }

    this.form.patchValue({color});
  }

  /**
   * Direct selection handler for the icon picker grid.
   * @param icon - The PrimeIcon class name.
   */
  selectIcon(icon: string): void {
    if (this.form.controls.icon.value === icon) {
      this.form.controls.icon.setValue('');
      return;
    }

    this.form.patchValue({icon});
  }

  /**
   * Translates an icon code into a readable label.
   * @param iconCode - The PrimeIcons code.
   * @returns A user-friendly string.
   */
  getIconLabel(iconCode: string): string {
    if (!iconCode) return '';
    return iconCode
      .replace('pi-', '')
      .split('-')
      .map((word: string): string => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
