import {AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators} from '@angular/forms';
import {Component, inject, input, InputSignal, OnChanges, output, OutputEmitterRef, signal, WritableSignal} from '@angular/core';
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
import {RecurringFrequency, RecurringRequest, RecurringTransaction} from '@models/recurring.model';
import {RecurringApiService} from '../../services/recurring-api.service';
import {ToastService} from '@core/services/toast.service';
import {AuthService} from '@core/auth/auth.service';

function futureDateValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  const date = control.value instanceof Date ? control.value : new Date(control.value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date > today ? null : { notFuture: true };
}

function pastDateValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  const date = control.value instanceof Date ? control.value : new Date(control.value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today ? null : { notPast: true };
}

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
  templateUrl: './recurring-form-dialog.component.html'
})
export class RecurringFormDialogComponent implements OnChanges {
  private readonly recurringApi = inject(RecurringApiService);
  private readonly toast = inject(ToastService);
  private readonly authService = inject(AuthService);

  // input signals
  visible: InputSignal<boolean> = input.required<boolean>();
  accounts: InputSignal<Account[]> = input.required<Account[]>();
  merchants: InputSignal<Merchant[]> = input.required<Merchant[]>();
  recurring: InputSignal<RecurringTransaction | null> = input<RecurringTransaction | null>(null);

  // output signals
  visibleChange: OutputEmitterRef<boolean> = output<boolean>();
  saved: OutputEmitterRef<void> = output<void>();

  // signals
  loading: WritableSignal<boolean> = signal(false);
  errorMessage: WritableSignal<string | null> = signal(null);

  frequencyOptions = [
    { label: 'Weekly', value: 'WEEKLY' as RecurringFrequency },
    { label: 'Bi-Weekly', value: 'BI_WEEKLY' as RecurringFrequency },
    { label: 'Monthly', value: 'MONTHLY' as RecurringFrequency },
    { label: 'Quarterly', value: 'QUARTERLY' as RecurringFrequency },
    { label: 'Yearly', value: 'YEARLY' as RecurringFrequency }
  ];

  form = new FormGroup({
    accountId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    merchantId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    amount: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(0.01), Validators.max(9999999999.99)]
    }),
    frequency: new FormControl<RecurringFrequency | null>(null, { validators: [Validators.required] }),
    nextDate: new FormControl<Date | null>(null, { validators: [Validators.required, futureDateValidator] }),
    lastDate: new FormControl<Date | null>(null, { validators: [pastDateValidator] }),
    active: new FormControl<boolean>(true, { nonNullable: true })
  });

  get accountOptions() {
    return this.accounts().map(a => ({ label: a.name, value: a.id }));
  }

  get merchantOptions() {
    return this.merchants().map(m => ({ label: m.cleanName, value: m.id }));
  }

  get isEditMode(): boolean {
    return this.recurring() !== null;
  }

  ngOnChanges(): void {
    const rec = this.recurring();
    if (rec) {
      this.form.patchValue({
        accountId: rec.account.id,
        merchantId: rec.merchant.id,
        amount: rec.amount,
        frequency: rec.frequency,
        nextDate: rec.nextDate ? new Date(rec.nextDate) : null,
        lastDate: rec.lastDate ? new Date(rec.lastDate) : null,
        active: rec.active
      });
    } else {
      this.form.reset({ accountId: null, merchantId: null, amount: null, frequency: null, nextDate: null, lastDate: null, active: true });
    }
    this.errorMessage.set(null);
  }

  onHide(): void {
    this.visibleChange.emit(false);
    this.form.reset({ active: true });
    this.errorMessage.set(null);
    this.loading.set(false);
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading()) return;

    const { accountId, merchantId, amount, frequency, nextDate, lastDate, active } = this.form.getRawValue();
    const userId = this.authService.user()?.id;
    if (!userId) return;

    const toISO = (d: Date | null): string | undefined =>
      d ? d.toISOString().split('T')[0] : undefined;

    const request: RecurringRequest = {
      userId,
      accountId: accountId!,
      merchantId: merchantId!,
      amount: amount!,
      frequency: frequency!,
      nextDate: toISO(nextDate)!,
      lastDate: toISO(lastDate),
      active: active
    };

    this.loading.set(true);
    const rec = this.recurring();
    const call$ = rec
      ? this.recurringApi.update({ ...request, id: rec.id })
      : this.recurringApi.create(request);

    call$
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (): void => {
          this.toast.success(rec ? 'Recurring transaction updated' : 'Recurring transaction created');
          this.saved.emit();
          this.onHide();
        },
        error: (error: any): void => {
          console.error('Error saving recurring transaction:', error);
          this.errorMessage.set(error.error?.detail || 'Failed to save recurring transaction');
        }
      });
  }
}
