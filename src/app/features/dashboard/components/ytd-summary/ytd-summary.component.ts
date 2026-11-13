import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  InputSignal,
  Signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { FormatCurrencyPipe } from '@shared/pipes/format-currency.pipe';

/**
 * Component for displaying an annual financial performance summary.
 *
 * Provides a high-level view of year-to-date income, expenses, and
 * the average savings rate with visual progress indicators.
 */
@Component({
  selector: 'app-ytd-summary',
  standalone: true,
  imports: [CommonModule, CardModule, FormatCurrencyPipe],
  templateUrl: './ytd-summary.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class YtdSummaryComponent {
  /** The year for which the summary is being displayed. */
  readonly year: InputSignal<number> = input.required<number>();

  /** The cumulative income for the year. */
  readonly totalIncome: InputSignal<number> = input.required<number>();

  /** The cumulative expenses for the year. */
  readonly totalExpense: InputSignal<number> = input.required<number>();

  /** The average savings rate as a percentage. */
  readonly avgSavingsRate: InputSignal<number> = input.required<number>();

  /** "so far" for the running year, "total" once the year has finished. */
  readonly title: Signal<string> = computed((): string =>
    this.year() < new Date().getFullYear() ? `${this.year()} total` : `${this.year()} so far`,
  );

  /**
   * Derived signal calculating the net savings (Income - Expenses).
   */
  readonly netSavings: Signal<number> = computed(
    (): number => this.totalIncome() - this.totalExpense(),
  );

  /**
   * Derived signal providing semantic Tailwind classes for the savings rate.
   */
  readonly savingsRateStyles = computed(() => {
    const rate: number = this.avgSavingsRate();

    if (rate >= 20) {
      return 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20';
    }

    if (rate > 0) {
      return 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20';
    }

    return 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20';
  });

  protected readonly Math = Math;
}
