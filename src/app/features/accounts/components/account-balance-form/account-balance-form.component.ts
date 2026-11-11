import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
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
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { DatePicker } from 'primeng/datepicker';
import { InputNumberModule } from 'primeng/inputnumber';
import { Account, BalanceEntryRequest, LOAN_TYPE_CODE } from '@models/account.model';
import { FormatCurrencyPipe } from '@shared/pipes/format-currency.pipe';
import { toLocalDateString } from '@shared/utils/transaction.utils';
import { toCents } from '../../utils/account-totals';

/**
 * The panel's balance step for a hand-entered account: the user types the balance and the day it
 * applies to. It emits the request and leaves the saving to its host.
 */
@Component({
  selector: 'app-account-balance-form',
  standalone: true,
  imports: [ReactiveFormsModule, InputNumberModule, DatePicker, FormatCurrencyPipe],
  templateUrl: './account-balance-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountBalanceFormComponent implements OnInit {
  /** The account whose balance is being recorded. */
  readonly account: InputSignal<Account> = input.required<Account>();
  /** A request is in flight; submitting is ignored meanwhile. */
  readonly saving: InputSignal<boolean> = input<boolean>(false);

  /** Emitted with the balance entry when the form is valid. */
  readonly recorded: OutputEmitterRef<BalanceEntryRequest> = output<BalanceEntryRequest>();

  /** The newest day that can be chosen: today (no future dates). */
  readonly maxDate: Date = new Date();

  readonly isLoan: Signal<boolean> = computed(
    (): boolean => this.account().type.code === LOAN_TYPE_CODE,
  );

  form = new FormGroup({
    balance: new FormControl<number | null>(null, { validators: [Validators.required] }),
    asOfDate: new FormControl<Date | null>(new Date(), { validators: [Validators.required] }),
  });

  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  /** The typed balance equals the one on screen, compared in whole cents. */
  readonly unchanged: Signal<boolean> = computed((): boolean => {
    const typed: number | null | undefined = this.formValue().balance;
    return (
      typed !== null &&
      typed !== undefined &&
      toCents(typed) === toCents(this.account().currentBalance)
    );
  });

  private filledFor: number | null = null;

  constructor() {
    effect((): void => {
      const id: number = this.account().id;
      untracked((): void => this.fill(id, this.isLoan()));
    });
  }

  ngOnInit(): void {
    this.fill(this.account().id, this.isLoan());
  }

  /** Starts empty for the shown account, with today's date; a loan accepts no negative amount. */
  private fill(id: number, loan: boolean): void {
    const validators: ValidatorFn[] = [Validators.required];
    if (loan) validators.push(Validators.min(0));
    this.form.controls.balance.setValidators(validators);
    if (id !== this.filledFor) {
      this.filledFor = id;
      this.form.reset({ balance: null, asOfDate: new Date() });
    }
    this.form.controls.balance.updateValueAndValidity({ emitEvent: false });
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.submit();
  }

  /** Emits the entry unless the form is incomplete or a request is in flight. */
  submit(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { balance, asOfDate } = this.form.getRawValue();
    this.recorded.emit({
      accountId: this.account().id,
      balance: balance!,
      asOfDate: toLocalDateString(asOfDate!),
      version: this.account().version,
    });
  }
}
