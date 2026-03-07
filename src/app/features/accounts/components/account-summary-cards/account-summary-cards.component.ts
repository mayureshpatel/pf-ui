import {Component, computed, input, InputSignal, Signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {CardModule} from 'primeng/card';
import {Account, AccountSummary} from '@models/account.model';
import {FormatCurrencyPipe} from '@shared/pipes/format-currency.pipe';

/**
 * Component for displaying summary cards of all financial accounts.
 *
 * Provides a high-level overview of total assets, total liabilities, and net worth.
 * It uses Angular Signals to reactively calculate these values whenever the underlying
 * account data changes.
 */
@Component({
  selector: 'app-account-summary-cards',
  standalone: true,
  imports: [CommonModule, CardModule, FormatCurrencyPipe],
  templateUrl: './account-summary-cards.component.html'
})
export class AccountSummaryCardsComponent {

  /**
   * The list of accounts to summarize.
   * Required input signal that triggers recalculation when changed.
   */
  accounts: InputSignal<Account[]> = input.required<Account[]>();

  /**
   * Derived summary data calculated from the accounts list.
   *
   * Separates accounts based on their `isAsset` flag and calculates totals.
   * Liabilities are always represented as a positive absolute value in the summary.
   */
  summary: Signal<AccountSummary> = computed(() => {
    const accountList = this.accounts();

    const totals = accountList.reduce((acc, account) => {
      if (account.type.isAsset) {
        acc.totalAssets += account.currentBalance;
      } else {
        acc.totalLiabilities += Math.abs(account.currentBalance);
      }
      return acc;
    }, { totalAssets: 0, totalLiabilities: 0 });

    return {
      totalAssets: totals.totalAssets,
      totalLiabilities: totals.totalLiabilities,
      netWorth: totals.totalAssets - totals.totalLiabilities
    };
  });
}
