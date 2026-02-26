import {Component, computed, input, InputSignal, Signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {CardModule} from 'primeng/card';
import {Account, AccountSummary} from '@models/account.model';
import {FormatCurrencyPipe} from '@shared/pipes/format-currency.pipe';

@Component({
  selector: 'app-account-summary-cards',
  standalone: true,
  imports: [CommonModule, CardModule, FormatCurrencyPipe],
  templateUrl: './account-summary-cards.component.html'
})
export class AccountSummaryCardsComponent {

  // input signals
  accounts: InputSignal<Account[]> = input.required<Account[]>();

  // computed signals
  summary: Signal<AccountSummary> = computed<AccountSummary>(() => {
    const accounts: Account[] = this.accounts();

    let totalAssets: number = 0;
    let totalLiabilities: number = 0;

    accounts.forEach((account: Account): void => {
      if (account.type.isAsset && account.currentBalance > 0) {
        totalAssets += account.currentBalance;
      } else if (!account.type.isAsset && account.currentBalance < 0) {
        totalLiabilities += Math.abs(account.currentBalance);
      }
    });

    return {
      totalAssets,
      totalLiabilities,
      netWorth: totalAssets - totalLiabilities
    };
  });
}
