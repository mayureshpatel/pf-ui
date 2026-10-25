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
  Signal,
  untracked,
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
import { Merchant, MerchantDescriptionLink } from '@models/merchant.model';

/** What the form hands the host to save; the host adds the user id. `id` is set when editing. */
export interface MerchantFormValue {
  id?: number;
  name: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

const notBlank = (control: AbstractControl): ValidationErrors | null =>
  String(control.value ?? '').trim() === '' ? { required: true } : null;

const blankToUndefined = (value: string | null): string | undefined => {
  const trimmed: string = (value ?? '').trim();
  return trimmed === '' ? undefined : trimmed;
};

/**
 * The panel's merchant and add modes: one form for both, the linked descriptions (edit mode only)
 * with a remove button on each, and the View transactions, Link descriptions and Delete actions.
 * Save lives in the panel's footer; the host calls {@link submit}.
 */
@Component({
  selector: 'app-merchant-edit-form',
  standalone: true,
  imports: [ReactiveFormsModule, InputTextModule],
  templateUrl: './merchant-edit-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantEditFormComponent implements OnInit {
  /** The merchant being edited (null when adding one). */
  readonly merchant: InputSignal<Merchant | null> = input<Merchant | null>(null);
  readonly links: InputSignal<MerchantDescriptionLink[]> = input<MerchantDescriptionLink[]>([]);

  readonly save: OutputEmitterRef<MerchantFormValue> = output<MerchantFormValue>();
  readonly removeLink: OutputEmitterRef<MerchantDescriptionLink> =
    output<MerchantDescriptionLink>();
  readonly openPicker: OutputEmitterRef<void> = output<void>();
  readonly viewTransactions: OutputEmitterRef<void> = output<void>();
  readonly deleteMerchant: OutputEmitterRef<void> = output<void>();

  readonly form = new FormGroup({
    name: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, notBlank, Validators.maxLength(255)],
    }),
    city: new FormControl<string>('', { nonNullable: true }),
    state: new FormControl<string>('', { nonNullable: true }),
    postalCode: new FormControl<string>('', { nonNullable: true }),
    country: new FormControl<string>('', { nonNullable: true }),
  });

  readonly isEditMode: Signal<boolean> = computed((): boolean => this.merchant() !== null);

  /** The merchant id the form was last filled for; it only refills when this changes. */
  private filledFor: number | 'new' | null = null;

  private readonly formEvents = toSignal(this.form.events);

  /** The inline name message, once the field has been touched. */
  readonly nameError: Signal<string | null> = computed((): string | null => {
    this.formEvents();
    const errors: ValidationErrors | null = this.form.controls.name.errors;
    if (!errors || !this.form.controls.name.touched) return null;
    return errors['maxlength'] ? 'Name must be 255 characters or fewer.' : 'Name is required.';
  });

  constructor() {
    effect((): void => {
      const key: number | 'new' = this.merchant()?.id ?? 'new';
      if (key === this.filledFor) return;
      untracked((): void => this.fill(key));
    });
  }

  /** Fills the form before the first render so early typing is never wiped by a later effect. */
  ngOnInit(): void {
    const key: number | 'new' = this.merchant()?.id ?? 'new';
    if (key !== this.filledFor) this.fill(key);
  }

  private fill(key: number | 'new'): void {
    this.filledFor = key;
    const merchant: Merchant | null = this.merchant();
    this.form.reset({
      name: merchant?.name ?? '',
      city: merchant?.city ?? '',
      state: merchant?.state ?? '',
      postalCode: merchant?.postalCode ?? '',
      country: merchant?.country ?? '',
    });
  }

  /** Submits from outside (the panel's Save button). */
  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const editing: Merchant | null = this.merchant();
    const value: MerchantFormValue = {
      name: raw.name.trim(),
      city: blankToUndefined(raw.city),
      state: blankToUndefined(raw.state),
      postalCode: blankToUndefined(raw.postalCode),
      country: blankToUndefined(raw.country),
    };
    this.save.emit(editing ? { id: editing.id, ...value } : value);
  }
}
