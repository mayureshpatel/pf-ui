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
import { Account } from '@models/account.model';
import { FormatCurrencyPipe } from '@shared/pipes/format-currency.pipe';
import { bankLabel } from '../../utils/account-totals';

/** The panel's first step: one account's balance and the actions available for it. */
@Component({
  selector: 'app-account-summary-view',
  standalone: true,
  imports: [FormatCurrencyPipe],
  templateUrl: './account-summary-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountSummaryViewComponent {
  readonly account: InputSignal<Account> = input.required<Account>();

  readonly reconcile: OutputEmitterRef<void> = output<void>();
  readonly viewTransactions: OutputEmitterRef<void> = output<void>();
  readonly edit: OutputEmitterRef<void> = output<void>();
  readonly delete: OutputEmitterRef<void> = output<void>();

  /** "<bank>, <type>", or just the type when the account has no bank. */
  readonly subtitle: Signal<string> = computed((): string => {
    const a: Account = this.account();
    const bank: string = bankLabel(a.bank);
    return bank ? `${bank}, ${a.type.label}` : a.type.label;
  });
}
