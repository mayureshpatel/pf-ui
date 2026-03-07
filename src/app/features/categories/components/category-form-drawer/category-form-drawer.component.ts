import {
  Component,
  computed,
  effect,
  inject,
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
import {CategoryApiService} from '../../services/category-api.service';
import {AuthService} from '@core/auth/auth.service';
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
  private readonly categoryApi: CategoryApiService = inject(CategoryApiService);
  private readonly authService: AuthService = inject(AuthService);

  // --- Signals: Inputs & Models ---

  /** Two-way binding for the drawer visibility. */
  readonly visible: ModelSignal<boolean> = model.required<boolean>();

  /** The category being edited, or null for creation mode. */
  readonly category: InputSignal<Category | null> = input<Category | null>(null);

  /** Indicates if a save operation is in flight. */
  readonly saving: InputSignal<boolean> = input(false);

  // --- Signals: Outputs ---

  /** Emitted when the category data is successfully validated and ready to save. */
  readonly save: OutputEmitterRef<CategoryCreateRequest | CategoryUpdateRequest> = output<CategoryCreateRequest | CategoryUpdateRequest>();

  // --- Signals: State ---

  /** Holds API or validation error messages. */
  readonly errorMessage: WritableSignal<string | null> = signal<string | null>(null);

  /** List of all categories for parent selection and validation. */
  readonly allCategories: WritableSignal<Category[]> = signal<Category[]>([]);

  /** Constant list of modern vibrant colors for categories. */
  readonly availableColors: string[] = CATEGORY_COLORS;

  /** Curated list of PrimeIcons suitable for financial categorization. */
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
    name: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(50)]
    }),
    color: new FormControl<string>('', {nonNullable: true}),
    icon: new FormControl<string>('', {nonNullable: true}),
    type: new FormControl<CategoryType>(CategoryType.EXPENSE, {nonNullable: true}),
    parentId: new FormControl<number | null>(null)
  });

  // --- Signals: Computed ---

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
    return this.allCategories()
      .filter((c: Category): boolean => c.id !== currentId && !c.parent)
      .map((c: Category) => ({label: c.name, value: c.id}));
  });

  /**
   * Real-time preview color based on user selection or auto-generation.
   */
  readonly previewColor: Signal<string> = computed((): string => {
    const selectedColor: string | undefined = this.form.value.color;
    if (selectedColor) return selectedColor;

    const name: string | undefined = this.form.value.name;
    return name ? getCategoryColor(name) : 'bg-surface-300';
  });

  constructor() {
    /**
     * Core effect to synchronize the form state whenever the input category changes
     * or the drawer is opened.
     */
    effect((): void => {
      const cat: Category | null = this.category();
      const isVisible: boolean = this.visible();

      if (isVisible) {
        this.loadCategories();
        if (cat) {
          this.form.patchValue({
            name: cat.name,
            color: cat.color || getCategoryColor(cat.name),
            icon: cat.icon || '',
            type: cat.type || CategoryType.EXPENSE,
            parentId: cat.parent?.id ?? null
          });
        } else {
          this.form.reset({
            name: '',
            color: '',
            icon: '',
            type: CategoryType.EXPENSE,
            parentId: null
          });
        }
        this.errorMessage.set(null);
      }
    });
  }

  /**
   * Loads categories from the API for the parent selection dropdown.
   */
  private loadCategories(): void {
    this.categoryApi.getCategories().subscribe({
      next: (categories: Category[]): void => this.allCategories.set(categories),
      error: (err: any): void => console.error('Failed to load categories for selection:', err)
    });
  }

  /**
   * Resets form state and closes the drawer.
   */
  onHide(): void {
    this.visible.set(false);
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

  /**
   * Validates and submits the category form.
   */
  onSubmit(): void {
    this.form.markAllAsTouched();
    this.errorMessage.set(null);

    if (this.form.invalid) return;

    const raw = this.form.getRawValue();
    const trimmedName: string = raw.name.trim();

    if (!trimmedName) {
      this.errorMessage.set('Category name is required.');
      return;
    }

    // Duplicate check
    const currentCat: Category | null = this.category();
    const isDuplicate: boolean = this.allCategories().some((c: Category): boolean =>
      c.name.toLowerCase() === trimmedName.toLowerCase() &&
      (c.parent?.id ?? null) === (raw.parentId ?? null) &&
      c.id !== currentCat?.id
    );

    if (isDuplicate) {
      const context: string = raw.parentId ? 'under the same parent' : 'as a top-level category';
      this.errorMessage.set(`A category with this name already exists ${context}.`);
      return;
    }

    const userId: number = this.authService.user()?.id ?? 0;

    if (currentCat) {
      const updateRequest: CategoryUpdateRequest = {
        id: currentCat.id,
        userId: userId,
        name: trimmedName,
        color: raw.color || getCategoryColor(trimmedName),
        icon: raw.icon,
        type: raw.type,
        parentId: raw.parentId ?? undefined
      };
      this.save.emit(updateRequest);
    } else {
      const createRequest: CategoryCreateRequest = {
        userId: userId,
        name: trimmedName,
        color: raw.color || getCategoryColor(trimmedName),
        icon: raw.icon,
        type: raw.type,
        parentId: raw.parentId ?? undefined
      };
      this.save.emit(createRequest);
    }
  }

  /**
   * Direct selection handler for the color picker grid.
   * @param color - The Tailwind background color class.
   */
  selectColor(color: string): void {
    this.form.patchValue({color});
  }

  /**
   * Direct selection handler for the icon picker grid.
   * @param icon - The PrimeIcon class name.
   */
  selectIcon(icon: string): void {
    this.form.patchValue({icon});
  }
}
