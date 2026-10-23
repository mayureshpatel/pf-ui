import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  InputSignal,
  Signal,
} from '@angular/core';
import { FormatCurrencyPipe } from '@shared/pipes/format-currency.pipe';
import { AccountTotals } from '../../utils/account-totals';

/** The net worth figure with a bar showing assets against liabilities. */
@Component({
  selector: 'app-account-net-worth-card',
  standalone: true,
  imports: [FormatCurrencyPipe],
  templateUrl: './account-net-worth-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountNetWorthCardComponent {
  /** Assets, liabilities and net worth for every account. */
  readonly totals: InputSignal<AccountTotals> = input.required<AccountTotals>();

  /** Assets' share of the bar, 0 to 100. */
  readonly assetsShare: Signal<number> = computed((): number => {
    const { assets, liabilities } = this.totals();
    const sum: number = assets + liabilities;
    return sum > 0 ? Math.round((assets / sum) * 1000) / 10 : 0;
  });

  /** Liabilities' share of the bar, 0 to 100 (0 when there is nothing to show). */
  readonly liabilitiesShare: Signal<number> = computed((): number => {
    const { assets, liabilities } = this.totals();
    return assets + liabilities > 0 ? Math.round((100 - this.assetsShare()) * 10) / 10 : 0;
  });

  /** The bar described in words, for assistive technology. */
  readonly barLabel: Signal<string> = computed((): string => {
    const money = (n: number): string =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
    const { assets, liabilities } = this.totals();
    return `Assets ${money(assets)}, liabilities ${money(liabilities)}`;
  });
}
