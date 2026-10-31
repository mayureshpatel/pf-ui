import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  InputSignal,
  Signal,
} from '@angular/core';
import { NetWorthMoved } from '../../models/reports.model';
import { movedRows } from '../../utils/net-worth-helpers';

const DOLLARS = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

interface MovedRowView {
  label: string;
  /** "+$9,860" or "-$320". */
  amount: string;
  /** "down" for a negative amount, read out beside the minus sign; a positive one needs no word. */
  direction: 'down' | null;
  total: boolean;
}

/**
 * What moved net worth over the range: the part saved (income minus spending) and the remainder (growth,
 * interest and adjustments), which together add up to the total change.
 */
@Component({
  selector: 'app-net-worth-moved',
  standalone: true,
  templateUrl: './net-worth-moved.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NetWorthMovedComponent {
  readonly moved: InputSignal<NetWorthMoved> = input.required<NetWorthMoved>();
  /** What the change is against ("a year ago"), or null for the range itself. */
  readonly compareLabel: InputSignal<string | null> = input.required<string | null>();

  protected readonly heading: Signal<string> = computed((): string => {
    const label: string | null = this.compareLabel();
    return `What moved it (${label ? `vs ${label}` : 'over the range'})`;
  });

  protected readonly rows: Signal<MovedRowView[]> = computed((): MovedRowView[] =>
    movedRows(this.moved()).map((row, index): MovedRowView => {
      const sign: string = row.amount < 0 ? '-' : '+';
      return {
        label: row.label,
        amount: `${sign}${DOLLARS.format(Math.abs(row.amount))}`,
        direction: row.amount < 0 ? 'down' : null,
        total: index === 2,
      };
    }),
  );
}
