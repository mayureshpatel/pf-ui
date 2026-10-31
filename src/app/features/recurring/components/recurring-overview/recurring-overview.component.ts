import {
  ChangeDetectionStrategy,
  Component,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RecurringTransaction } from '@models/recurring.model';
import { RecurringTotals, nextDateOf, shortDate } from '../../utils/recurring-helpers';

/** The panel's default mode: what the tracked items cost, what is due next and which prices changed. */
@Component({
  selector: 'app-recurring-overview',
  standalone: true,
  imports: [CurrencyPipe],
  templateUrl: './recurring-overview.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecurringOverviewComponent {
  readonly totals: InputSignal<RecurringTotals> = input.required<RecurringTotals>();
  readonly comingUp: InputSignal<RecurringTransaction[]> = input.required<RecurringTransaction[]>();
  /** Tracked items whose real charges differ from their stored amount. */
  readonly priceChanges: InputSignal<RecurringTransaction[]> =
    input.required<RecurringTransaction[]>();
  readonly patternCount: InputSignal<number> = input.required<number>();

  readonly add: OutputEmitterRef<void> = output<void>();
  readonly reviewPatterns: OutputEmitterRef<void> = output<void>();

  /** The day a price change took effect, such as "Sep 3". */
  sinceOf(item: RecurringTransaction): string {
    return item.priceChange ? shortDate(item.priceChange.since) : '';
  }

  dateOf(item: RecurringTransaction): string {
    return shortDate(nextDateOf(item));
  }

  servicesLabel(count: number): string {
    return count === 1 ? '1 service' : `${count} services`;
  }
}
