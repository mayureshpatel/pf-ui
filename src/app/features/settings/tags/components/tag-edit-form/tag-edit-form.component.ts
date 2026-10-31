import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  InputSignal,
  OnInit,
  output,
  OutputEmitterRef,
  signal,
  Signal,
  untracked,
  WritableSignal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { Tag } from '@models/tag.model';
import { CATEGORY_COLORS } from '@shared/utils/category.utils';
import {
  DEFAULT_TAG_COLOR,
  normalizeHex,
  readableTextColor,
} from '../../../utils/settings-helpers';

const DEFAULT_COLOR = '3b82f6';
const MAX_NAME_LENGTH = 50;
const HEX_PATTERN = /^[0-9a-fA-F]{6}$/;
const OPTIONAL_HEX_PATTERN = /^([0-9a-fA-F]{6})?$/;

/** What the form hands the host for a new tag (the host adds the user). */
export interface TagCreateValue {
  name: string;
  /** `#rrggbb`, or null for a tag that has no colour. */
  color: string | null;
}
export interface TagUpdateValue extends TagCreateValue {
  id: number;
}

function nameValidator(control: AbstractControl<string>): ValidationErrors | null {
  const length: number = (control.value ?? '').trim().length;
  if (length === 0) return { required: true };
  return length > MAX_NAME_LENGTH ? { maxlength: true } : null;
}

/**
 * One form for adding and editing a tag, shown in the Settings panel. The colour is a bare hex string in
 * the form (no `#`) and is sent with one, as everywhere else in the app. Nothing is saved here:
 * `submit()` (called from the panel's Save button) emits the request for the host.
 */
@Component({
  selector: 'app-tag-edit-form',
  standalone: true,
  imports: [ReactiveFormsModule, InputTextModule],
  templateUrl: './tag-edit-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagEditFormComponent implements OnInit {
  /** The tag being edited (null when adding one). */
  readonly tag: InputSignal<Tag | null> = input<Tag | null>(null);
  readonly saving: InputSignal<boolean> = input<boolean>(false);

  readonly save: OutputEmitterRef<TagCreateValue | TagUpdateValue> = output<
    TagCreateValue | TagUpdateValue
  >();
  readonly remove: OutputEmitterRef<void> = output<void>();
  readonly viewTransactions: OutputEmitterRef<void> = output<void>();

  /** A message the form itself cannot express, such as the server's refusal. */
  readonly errorMessage: WritableSignal<string | null> = signal<string | null>(null);

  readonly swatches: string[] = CATEGORY_COLORS;
  readonly swatchNames: string[] = [
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

  readonly form = new FormGroup({
    name: new FormControl<string>('', { nonNullable: true, validators: [nameValidator] }),
    color: new FormControl<string>(DEFAULT_COLOR, {
      nonNullable: true,
      validators: [Validators.pattern(OPTIONAL_HEX_PATTERN)],
    }),
  });

  readonly isEditMode: Signal<boolean> = computed((): boolean => this.tag() !== null);

  /** Which tag (or a new one) is shown; the form resets only when it changes. */
  private readonly formKey: Signal<string> = computed((): string =>
    String(this.tag()?.id ?? 'new'),
  );
  /** What the open tag's fields were when the form was last filled, to tell a changed copy from the same one. */
  private readonly contentKey: Signal<string> = computed((): string => {
    const t: Tag | null = this.tag();
    return t ? JSON.stringify([t.name, normalizeHex(t.color)]) : '';
  });
  private filledFor: string | null = null;
  private filledContent: string | null = null;

  private readonly formEvents = toSignal(this.form.events);

  readonly nameError: Signal<string | null> = computed((): string | null => {
    this.formEvents();
    const control = this.form.controls.name;
    if (!control.errors || !control.touched) return null;
    return control.errors['maxlength']
      ? `Name must be ${MAX_NAME_LENGTH} characters or fewer.`
      : 'Name is required.';
  });

  readonly colorError: Signal<string | null> = computed((): string | null => {
    this.formEvents();
    const control = this.form.controls.color;
    return control.invalid && control.touched
      ? 'Enter a 6-digit hex colour, such as 3B82F6.'
      : null;
  });

  /** The colour as a CSS value for the preview, falling back to the default while it is invalid. */
  readonly previewColor: Signal<string> = computed((): string => {
    this.formEvents();
    const value: string = this.form.controls.color.value;
    return HEX_PATTERN.test(value) ? `#${value}` : DEFAULT_TAG_COLOR;
  });

  readonly previewTextColor: Signal<string> = computed((): string =>
    readableTextColor(this.previewColor()),
  );

  readonly previewName: Signal<string> = computed((): string => {
    this.formEvents();
    return this.form.controls.name.value.trim() || 'Tag preview';
  });

  constructor() {
    effect((): void => {
      const key: string = this.formKey();
      const content: string = this.contentKey();
      // a changed copy of the same tag refills only while the user has typed nothing
      const changedCopy: boolean = content !== this.filledContent;
      if (
        key === this.filledFor &&
        !(changedCopy && untracked((): boolean => this.form.pristine))
      ) {
        return;
      }
      untracked((): void => this.fill(key));
    });
  }

  /** Fills synchronously before the first render, so text typed at once is never wiped by the effect. */
  ngOnInit(): void {
    const key: string = this.formKey();
    if (key !== this.filledFor) this.fill(key);
  }

  private fill(key: string): void {
    this.filledFor = key;
    this.filledContent = this.contentKey();
    this.errorMessage.set(null);
    const tag: Tag | null = this.tag();
    this.form.reset({
      name: tag?.name ?? '',
      // a new tag starts blue; an existing one keeps what it has, including no colour at all
      color: tag ? normalizeHex(tag.color) : DEFAULT_COLOR,
    });
  }

  /** Takes what was typed or pasted as the colour, dropping a leading # and anything past six digits. */
  onColorInput(input: HTMLInputElement): void {
    const cleaned: string = input.value.replace('#', '').slice(0, 6);
    input.value = cleaned;
    this.form.controls.color.setValue(cleaned);
    this.form.controls.color.markAsDirty();
  }

  isSwatchSelected(swatch: string): boolean {
    return `#${this.form.controls.color.value}`.toUpperCase() === swatch.toUpperCase();
  }

  selectSwatch(swatch: string): void {
    this.form.controls.color.setValue(swatch.replace('#', ''));
    this.form.controls.color.markAsDirty();
  }

  /** Submits from outside (the panel's Save button). */
  submit(): void {
    this.errorMessage.set(null);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    const raw = this.form.getRawValue();
    const common: TagCreateValue = {
      name: raw.name.trim(),
      color: raw.color ? `#${raw.color}` : null,
    };
    const editing: Tag | null = this.tag();
    this.save.emit(editing ? { id: editing.id, ...common } : common);
  }
}
