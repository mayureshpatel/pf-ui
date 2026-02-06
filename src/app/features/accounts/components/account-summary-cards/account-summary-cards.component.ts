import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { Account, AccountSummary } from '@models/account.model';
import { isAssetAccount, isLiabilityAccount } from '@shared/utils/account.utils';
import {FormatCurrencyPipe} from '@shared/pipes/format-currency.pipe';

@Component({
  selector: 'app-account-summary-cards',
  standalone: true,
  imports: [CommonModule, CardModule, FormatCurrencyPipe],
  templateUrl: './account-summary-cards.component.html'
})
export class AccountSummaryCardsComponent {
  accounts = input.required<Account[]>();

  summary = computed<AccountSummary>(() => {
    const accounts = this.accounts();

    let totalAssets = 0;
    let totalLiabilities = 0;

    accounts.forEach(account => {
      if (isAssetAccount(account.type) && account.currentBalance > 0) {
        totalAssets += account.currentBalance;
      } else if (isLiabilityAccount(account.type) && account.currentBalance < 0) {
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
