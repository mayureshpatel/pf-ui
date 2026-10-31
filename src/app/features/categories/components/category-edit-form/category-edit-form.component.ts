import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  InputSignal,
  output,
  OnInit,
  OutputEmitterRef,
  signal,
  Signal,
  untracked,
  WritableSignal,
} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import {
  Category,
  CategoryCreateRequest,
  CategoryType,
  CategoryUpdateRequest,
} from '@models/category.model';
import { CATEGORY_COLORS, getCategoryColor } from '@shared/utils/category.utils';
import { parentOptions } from '../../utils/category-helpers';

const COLOR_NAMES: string[] = [
  'Blue',
  'Green',
  'Purple',
  'Orange',
  'Pink',
  'Teal',
  'Indigo',
  'Red',
  'Yellow',
  'Cyan',
];

const notBlank = (control: AbstractControl): ValidationErrors | null =>
  String(control.value ?? '').trim() === '' ? { required: true } : null;

/** A name is limited by its length once trimmed, since the trimmed text is what gets saved. */
const trimmedMaxLength =
  (max: number) =>
  (control: AbstractControl): ValidationErrors | null => {
    const length: number = String(control.value ?? '').trim().length;
    return length > max ? { maxlength: { requiredLength: max, actualLength: length } } : null;
  };

/** The panel's category and add modes: one form for both, plus View transactions and Delete. */
@Component({
  selector: 'app-category-edit-form',
  standalone: true,
  imports: [ReactiveFormsModule, InputTextModule, SelectModule],
  templateUrl: './category-edit-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryEditFormComponent implements OnInit {
  /** The category being edited (null when adding one). */
  readonly category: InputSignal<Category | null> = input<Category | null>(null);
  /** Every category, flat, for the parent choices and the duplicate check. */
  readonly categories: InputSignal<Category[]> = input.required<Category[]>();
  /** Pre-selects a parent when adding from a parent's panel. */
  readonly defaultParentId: InputSignal<number | null> = input<number | null>(null);
  readonly saving: InputSignal<boolean> = input<boolean>(false);
  /** Why Delete cannot work (it has transactions or subcategories), or null when it can. */
  readonly deleteBlockedReason: InputSignal<string | null> = input<string | null>(null);

  readonly save: OutputEmitterRef<CategoryCreateRequest | CategoryUpdateRequest> = output<
    CategoryCreateRequest | CategoryUpdateRequest
  >();
  readonly remove: OutputEmitterRef<void> = output<void>();
  readonly viewTransactions: OutputEmitterRef<void> = output<void>();

  /** A message the form itself cannot express, such as a duplicate name. */
  readonly errorMessage: WritableSignal<string | null> = signal<string | null>(null);

  readonly colors: string[] = CATEGORY_COLORS;
  readonly colorNames: string[] = COLOR_NAMES;
  readonly icons: string[] = [
    'pi-shopping-cart',
    'pi-home',
    'pi-car',
    'pi-money-bill',
    'pi-briefcase',
    'pi-heart',
    'pi-bolt',
    'pi-globe',
    'pi-gift',
    'pi-users',
    'pi-book',
    'pi-desktop',
    'pi-phone',
    'pi-wrench',
    'pi-shield',
    'pi-tag',
    'pi-ticket',
    'pi-wallet',
    'pi-star',
    'pi-key',
  ];
  readonly typeOptions: { label: string; value: CategoryType }[] = [
    { label: 'Expense', value: CategoryType.EXPENSE },
    { label: 'Income', value: CategoryType.INCOME },
    { label: 'Both', value: CategoryType.BOTH },
  ];

  readonly form = new FormGroup({
    name: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, notBlank, trimmedMaxLength(50)],
    }),
    type: new FormControl<CategoryType>(CategoryType.EXPENSE, { nonNullable: true }),
    parentId: new FormControl<number | null>(null),
    icon: new FormControl<string>(''),
    color: new FormControl<string>(''),
  });

  readonly isEditMode: Signal<boolean> = computed((): boolean => this.category() !== null);

  readonly parentChoices: Signal<Category[]> = computed((): Category[] =>
    parentOptions(this.categories(), this.category()),
  );

  readonly parentSelectOptions: Signal<{ label: string; value: number }[]> = computed(() =>
    this.parentChoices().map((c: Category) => ({ label: c.name, value: c.id })),
  );

  /** Which category (or a new one, for which parent) is shown; the form resets only when it changes. */
  private readonly formKey: Signal<string> = computed(
    (): string => `${this.category()?.id ?? 'new'}:${this.defaultParentId() ?? ''}`,
  );

  /** The key the form was last filled for; the effect only resets when it really changes. */
  private filledFor: string | null = null;

  constructor() {
    effect((): void => {
      const key: string = this.formKey();
      if (key === this.filledFor) return;
      untracked((): void => this.fill(key));
    });
  }

  /**
   * Fills the form at init, synchronously and before the first render, so a user who types at once
   * can never have their text wiped by an effect that runs a moment later.
   */
  ngOnInit(): void {
    const key: string = this.formKey();
    if (key !== this.filledFor) this.fill(key);
  }

  private fill(key: string): void {
    this.filledFor = key;
    this.reset();
  }

  private reset(): void {
    this.errorMessage.set(null);
    const category: Category | null = this.category();
    this.form.reset({
      name: category?.name ?? '',
      type: category?.type ?? CategoryType.EXPENSE,
      parentId: category ? (category.parent?.id ?? null) : this.defaultParentId(),
      icon: category?.icon ?? '',
      color: category ? category.color || getCategoryColor(category.name) : CATEGORY_COLORS[0],
    });
  }

  selectColor(color: string): void {
    this.form.controls.color.setValue(this.form.controls.color.value === color ? '' : color);
    this.form.controls.color.markAsDirty();
  }

  selectIcon(icon: string): void {
    this.form.controls.icon.setValue(this.form.controls.icon.value === icon ? '' : icon);
    this.form.controls.icon.markAsDirty();
  }

  iconLabel(icon: string): string {
    return icon.replace(/^pi-/, '').replace(/-/g, ' ');
  }

  /** Re-evaluates the form-derived signals below whenever the form's value or state changes. */
  private readonly formEvents = toSignal(this.form.events);

  /** The inline name message, once the field has been touched. */
  readonly nameError: Signal<string | null> = computed((): string | null => {
    this.formEvents();
    const errors: ValidationErrors | null = this.form.controls.name.errors;
    if (!errors || !this.form.controls.name.touched) return null;
    return errors['maxlength'] ? 'Name must be 50 characters or fewer.' : 'Name is required.';
  });

  /** Submits from outside (the panel's Save button). */
  submit(): void {
    this.errorMessage.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const name: string = raw.name.trim();
    const editing: Category | null = this.category();

    const duplicate: boolean = this.categories().some(
      (c: Category): boolean =>
        c.name.toLowerCase() === name.toLowerCase() &&
        (c.parent?.id ?? null) === (raw.parentId ?? null) &&
        c.id !== editing?.id,
    );
    if (duplicate) {
      this.errorMessage.set(
        `A category with this name already exists ${raw.parentId ? 'under the same parent' : 'as a top-level category'}.`,
      );
      return;
    }

    const common = {
      name,
      type: raw.type,
      color: raw.color || getCategoryColor(name),
      icon: raw.icon || undefined,
      parentId: raw.parentId ?? undefined,
    };
    this.save.emit(editing ? { id: editing.id, ...common } : common);
  }
}
