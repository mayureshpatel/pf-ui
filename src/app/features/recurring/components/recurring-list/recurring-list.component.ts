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
import {
  expectedText,
  nextDateOf,
  priceChangeText,
  RecurringGroup,
  shortDate,
} from '../../utils/recurring-helpers';

/**
 * The tracked recurring items grouped by how often they are paid. It renders the groups it is
 * given and owns no state: selection and the loading flag come in as inputs and the chosen item goes
 * out as an event.
 */
@Component({
  selector: 'app-recurring-list',
  standalone: true,
  imports: [CurrencyPipe],
  templateUrl: './recurring-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecurringListComponent {
  readonly groups: InputSignal<RecurringGroup[]> = input.required<RecurringGroup[]>();
  readonly selectedId: InputSignal<number | null> = input.required<number | null>();
  readonly loading: InputSignal<boolean> = input.required<boolean>();

  readonly openItem: OutputEmitterRef<RecurringTransaction> = output<RecurringTransaction>();

  /** The second line of a row: when it is next due (or expected, or that it is paused), and where from. */
  schedule(item: RecurringTransaction): { text: string; late: boolean } {
    const expected: string | null = expectedText(item);
    if (!item.active) {
      return { text: 'Paused', late: false };
    }
    return expected
      ? { text: expected, late: true }
      : { text: `Next ${shortDate(nextDateOf(item))}`, late: false };
  }

  priceChange(item: RecurringTransaction): string | null {
    return item.priceChange ? priceChangeText(item.priceChange) : null;
  }

  pausedLabel(count: number): string {
    return `${count} paused`;
  }
}
