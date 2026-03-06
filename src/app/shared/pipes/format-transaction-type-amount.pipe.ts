import {inject, Pipe, PipeTransform} from '@angular/core';
import {FormatCurrencyPipe} from '@shared/pipes/format-currency.pipe';

@Pipe({name: 'formatTransactionTypeAmount'})
export class FormatTransactionTypeAmountPipe implements PipeTransform {

  private readonly formatCurrencyPipe: FormatCurrencyPipe = inject(FormatCurrencyPipe);

  transform(amount: number, type: string): string {
    const formattedCurrency: string = this.formatCurrencyPipe.transform(amount, true);
    switch (type.toLowerCase()) {
      case 'income':
      case 'transfer-in':
        return `+${formattedCurrency}`;
      case 'expense':
      case 'transfer':
      case 'transfer-out':
        return `-${formattedCurrency}`;
      default:
        return formattedCurrency;
    }
  }
}
