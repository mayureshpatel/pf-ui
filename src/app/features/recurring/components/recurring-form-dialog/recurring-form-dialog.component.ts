import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
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
  Signal,
  signal,
  WritableSignal
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {finalize} from 'rxjs';
import {DialogModule} from 'primeng/dialog';
import {ButtonModule} from 'primeng/button';
import {InputNumberModule} from 'primeng/inputnumber';
import {SelectModule} from 'primeng/select';
import {DatePicker} from 'primeng/datepicker';
import {ToggleSwitchModule} from 'primeng/toggleswitch';
import {MessageModule} from 'primeng/message';

import {Account} from '@models/account.model';
import {Merchant} from '@models/merchant.model';
import {
  RecurringFrequency,
  RecurringSuggestion,
  RecurringTransaction,
  RecurringTransactionCreateRequest,
  RecurringTransactionUpdateRequest
} from '@models/recurring.model';
import {RecurringApiService} from '../../services/recurring-api.service';
import {ToastService} from '@core/services/toast.service';
import {AuthService} from '@core/auth/auth.service';

/**
 * Custom validator ensuring a date is in the future.
 */
function futureDateValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) {
    return null;
  }

  const date: Date = control.value instanceof Date ? control.value : new Date(control.value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date > today ? null : {notFuture: true};
}

/**
 * Dialog component for creating or updating recurring transactions.
 *
 * Supports manual entry, editing existing records, and pre-filling from
 * recurring pattern suggestions.
 */
@Component({
  selector: 'app-recurring-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogModule,
    ButtonModule,
    InputNumberModule,
    SelectModule,
    DatePicker,
    ToggleSwitchModule,
    MessageModule
  ],
  templateUrl: './recurring-form-dialog.component.html',
})
export class RecurringFormDialogComponent {
  private readonly recurringApi: RecurringApiService = inject(RecurringApiService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly authService: AuthService = inject(AuthService);

  /** Two-way binding for dialog visibility. */
  readonly visible: ModelSignal<boolean> = model.required<boolean>();

  /** The list of available accounts. */
  readonly accounts: InputSignal<Account[]> = input.required<Account[]>();

  /** The list of known merchants. */
  readonly merchants: InputSignal<Merchant[]> = input.required<Merchant[]>();

  /** Existing recurring entry for editing. */
  readonly recurring: InputSignal<RecurringTransaction | null> = input<RecurringTransaction | null>(null);

  /** A pattern suggestion to pre-fill the form. */
  readonly suggestion: InputSignal<RecurringSuggestion | null> = input<RecurringSuggestion | null>(null);

  /** Emitted when a record is successfully saved to the backend. */
  readonly saved: OutputEmitterRef<void> = output<void>();

  /** Indicates if an API operation is in progress. */
  readonly loading: WritableSignal<boolean> = signal(false);

  /** Holds validation or API error messages. */
  readonly errorMessage: WritableSignal<string | null> = signal<string | null>(null);

  /** Options for payment frequency. */
  readonly frequencyOptions = [
    {label: 'Weekly', value: 'WEEKLY' as RecurringFrequency},
    {label: 'Bi-Weekly', value: 'BI_WEEKLY' as RecurringFrequency},
    {label: 'Monthly', value: 'MONTHLY' as RecurringFrequency},
    {label: 'Quarterly', value: 'QUARTERLY' as RecurringFrequency},
    {label: 'Yearly', value: 'YEARLY' as RecurringFrequency}
  ];

  /**
   * Strongly typed form for recurring transaction details.
   */
  readonly form = new FormGroup({
    accountId: new FormControl<number | null>(null, {validators: [Validators.required]}),
    merchantId: new FormControl<number | null>(null, {validators: [Validators.required]}),
    amount: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(0.01), Validators.max(99999999)]
    }),
    frequency: new FormControl<RecurringFrequency | null>(null, {validators: [Validators.required]}),
    nextDate: new FormControl<Date | null>(null, {validators: [Validators.required, futureDateValidator]}),
    active: new FormControl<boolean>(true, {nonNullable: true})
  });

  /** Indicates if the form is in edit mode. */
  readonly isEditMode: Signal<boolean> = computed((): boolean => this.recurring() !== null);

  /** Derived options for the account selection dropdown. */
  readonly accountOptions = computed(() =>
    this.accounts().map((a: Account) => ({label: a.name, value: a.id, type: a.type.label}))
  );

  /** Derived options for the merchant selection dropdown. */
  readonly merchantOptions = computed(() =>
    this.merchants().map((m: Merchant) => ({label: m.cleanName, value: m.id}))
  );

  constructor() {
    /**
     * Effect to reactively synchronize the form whenever input data changes.
     * Handles switching between Create, Edit, and Suggestion modes.
     */
    effect((): void => {
      const isVisible: boolean = this.visible();
      const rec: RecurringTransaction | null = this.recurring();
      const sug: RecurringSuggestion | null = this.suggestion();

      if (isVisible) {
        if (rec) {
          this.form.patchValue({
            accountId: rec.account.id,
            merchantId: rec.merchant.id,
            amount: rec.amount,
            frequency: rec.frequency,
            nextDate: rec.nextDate ? new Date(rec.nextDate) : null,
            active: rec.active
          });
        } else if (sug) {
          this.form.patchValue({
            merchantId: sug.merchant.id,
            amount: sug.amount,
            frequency: sug.frequency,
            nextDate: sug.nextDate ? new Date(sug.nextDate) : null,
            active: true
          });
        } else {
          this.form.reset({active: true});
        }
        this.errorMessage.set(null);
      }
    });
  }

  /**
   * Resets form state and closes the dialog.
   */
  onHide(): void {
    this.visible.set(false);
  }

  /**
   * Validates and submits the form data to the API.
   */
  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading()) return;

    const raw = this.form.getRawValue();
    const userId: number | undefined = this.authService.user()?.id;
    if (!userId) {
      this.errorMessage.set('User authentication session expired.');
      return;
    }

    const nextDateISO: string = raw.nextDate ? raw.nextDate.toISOString().split('T')[0] : '';

    this.loading.set(true);
    this.errorMessage.set(null);

    const rec: RecurringTransaction | null = this.recurring();

    if (rec) {
      // UPDATE
      const updateReq: RecurringTransactionUpdateRequest = {
        id: rec.id,
        accountId: raw.accountId!,
        merchantId: raw.merchantId!,
        amount: raw.amount!,
        frequency: raw.frequency!,
        nextDate: nextDateISO,
        active: raw.active
      };

      this.recurringApi.update(updateReq)
        .pipe(finalize(() => this.loading.set(false)))
        .subscribe({
          next: () => this.handleSuccess('Recurring entry updated'),
          error: (err) => this.handleError(err, 'Failed to update entry')
        });
    } else {
      // CREATE
      const createReq: RecurringTransactionCreateRequest = {
        userId,
        accountId: raw.accountId!,
        merchantId: raw.merchantId!,
        amount: raw.amount!,
        frequency: raw.frequency!,
        nextDate: nextDateISO,
        active: raw.active
      };

      this.recurringApi.create(createReq)
        .pipe(finalize((): void => this.loading.set(false)))
        .subscribe({
          next: (): void => this.handleSuccess('Recurring entry created'),
          error: (err: any): void => this.handleError(err, 'Failed to create entry')
        });
    }
  }

  private handleSuccess(message: string): void {
    this.toast.success(message);
    this.saved.emit();
    this.onHide();
  }

  private handleError(error: any, fallback: string): void {
    console.error('Recurring error:', error);
    this.errorMessage.set(error.error?.detail || fallback);
  }
}
