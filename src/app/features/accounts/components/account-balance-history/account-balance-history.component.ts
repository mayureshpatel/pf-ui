import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  InputSignal,
  Signal,
} from '@angular/core';
import { AccountSnapshot } from '@models/account.model';
import { FormatCurrencyPipe } from '@shared/pipes/format-currency.pipe';

/** The recorded balances of a hand-entered account, newest first. It owns no data. */
@Component({
  selector: 'app-account-balance-history',
  standalone: true,
  imports: [FormatCurrencyPipe],
  templateUrl: './account-balance-history.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountBalanceHistoryComponent {
  readonly entries: InputSignal<AccountSnapshot[]> = input.required<AccountSnapshot[]>();
  readonly currencyCode: InputSignal<string> = input<string>('USD');

  /** The entries ordered by date, then id, newest first, whatever order they arrive in. */
  readonly sorted: Signal<AccountSnapshot[]> = computed((): AccountSnapshot[] =>
    [...this.entries()].sort(
      (a: AccountSnapshot, b: AccountSnapshot): number =>
        b.snapshotDate.localeCompare(a.snapshotDate) || b.id - a.id,
    ),
  );
}
