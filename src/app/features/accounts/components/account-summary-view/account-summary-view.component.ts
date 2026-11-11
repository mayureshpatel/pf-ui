import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
  Signal,
} from '@angular/core';
import { Account, AccountSnapshot, LOAN_TYPE_CODE } from '@models/account.model';
import { FormatCurrencyPipe } from '@shared/pipes/format-currency.pipe';
import { AccountBalanceHistoryComponent } from '../account-balance-history/account-balance-history.component';
import { bankLabel } from '../../utils/account-totals';

/** The panel's first step: one account's balance and the actions available for it. */
@Component({
  selector: 'app-account-summary-view',
  standalone: true,
  imports: [FormatCurrencyPipe, AccountBalanceHistoryComponent],
  templateUrl: './account-summary-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountSummaryViewComponent {
  readonly account: InputSignal<Account> = input.required<Account>();

  /** The recorded balances, shown for a hand-entered account. */
  readonly history: InputSignal<AccountSnapshot[]> = input<AccountSnapshot[]>([]);

  readonly reconcile: OutputEmitterRef<void> = output<void>();
  readonly updateBalance: OutputEmitterRef<void> = output<void>();
  readonly viewTransactions: OutputEmitterRef<void> = output<void>();
  readonly edit: OutputEmitterRef<void> = output<void>();
  readonly delete: OutputEmitterRef<void> = output<void>();

  /** The balance is typed in by the user instead of coming from transactions. */
  readonly isManual: Signal<boolean> = computed(
    (): boolean => this.account().balanceMode === 'MANUAL',
  );

  /** A loan shows only what is left to pay, with no money in or gain. */
  readonly isLoan: Signal<boolean> = computed(
    (): boolean => this.account().type.code === LOAN_TYPE_CODE,
  );

  /** "<bank>, <type>", or just the type when the account has no bank. */
  readonly subtitle: Signal<string> = computed((): string => {
    const a: Account = this.account();
    const bank: string = bankLabel(a.bank);
    return bank ? `${bank}, ${a.type.label}` : a.type.label;
  });
}
