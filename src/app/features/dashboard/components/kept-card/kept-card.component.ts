import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  InputSignal,
  Signal,
} from '@angular/core';
import { CardModule } from 'primeng/card';
import { FormatCurrencyPipe } from '@shared/pipes/format-currency.pipe';

/** Rounds to whole cents so floating point noise never reaches the screen. */
const toCents = (value: number): number => Math.round(value * 100) / 100;

/**
 * The dashboard's headline card: how much money was kept this period, the savings rate it
 * represents, and how that compares with the previous period.
 */
@Component({
  selector: 'app-kept-card',
  standalone: true,
  imports: [CardModule, FormatCurrencyPipe],
  templateUrl: './kept-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KeptCardComponent {
  /** Income for the current period. */
  readonly income: InputSignal<number> = input.required<number>();

  /** Expenses for the current period. */
  readonly expense: InputSignal<number> = input.required<number>();

  /** Income for the previous period. */
  readonly previousIncome: InputSignal<number> = input.required<number>();

  /** Expenses for the previous period. */
  readonly previousExpense: InputSignal<number> = input.required<number>();

  /** Savings rate for the current period, as a percentage (0 to 100, may be negative). */
  readonly savingsRate: InputSignal<number> = input.required<number>();

  /** Income minus expenses for the current period. */
  readonly kept: Signal<number> = computed((): number => toCents(this.income() - this.expense()));

  /** Whether expenses exceeded income. */
  readonly isNegative: Signal<boolean> = computed((): boolean => this.kept() < 0);

  /** Kept now minus kept in the previous period. Positive means more was kept. */
  readonly change: Signal<number> = computed((): number =>
    toCents(this.kept() - (this.previousIncome() - this.previousExpense())),
  );

  /** The size of the change, without its sign. */
  readonly changeAmount: Signal<number> = computed((): number => Math.abs(this.change()));

  /** Text for the savings rate pill. */
  readonly rateLabel: Signal<string> = computed((): string =>
    this.income() > 0 ? `${this.savingsRate().toFixed(1)}% of income` : 'No income',
  );

  /** Progress bar width as a percentage, clamped to 0 to 100 and empty when there is no income. */
  readonly barWidth: Signal<number> = computed((): number =>
    this.income() > 0 ? Math.min(Math.max(this.savingsRate(), 0), 100) : 0,
  );
}
