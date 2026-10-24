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
  selector: 'app-account-overview',
  standalone: true,
  imports: [FormatCurrencyPipe],
  templateUrl: './account-overview.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountOverviewComponent {
  /** Assets, liabilities and net worth for every account. */
  readonly totals: InputSignal<AccountTotals> = input.required<AccountTotals>();

  private readonly currency: FormatCurrencyPipe = new FormatCurrencyPipe();

  /** Assets' share of the bar, 0 to 100 (negative totals count as zero so the bar cannot overflow). */
  readonly assetsShare: Signal<number> = computed((): number => {
    const assets: number = Math.max(this.totals().assets, 0);
    const liabilities: number = Math.max(this.totals().liabilities, 0);
    const sum: number = assets + liabilities;
    return sum > 0 ? Math.round((assets / sum) * 1000) / 10 : 0;
  });

  /** Liabilities' share of the bar, 0 to 100 (0 when there is nothing to show). */
  readonly liabilitiesShare: Signal<number> = computed((): number => {
    const sum: number = Math.max(this.totals().assets, 0) + Math.max(this.totals().liabilities, 0);
    return sum > 0 ? Math.round((100 - this.assetsShare()) * 10) / 10 : 0;
  });

  /** The bar described in words, for assistive technology. */
  readonly barLabel: Signal<string> = computed(
    (): string =>
      `Assets ${this.currency.transform(this.totals().assets)}, liabilities ${this.currency.transform(this.totals().liabilities)}`,
  );
}
