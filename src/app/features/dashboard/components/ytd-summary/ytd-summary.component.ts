import {Component, computed, input, InputSignal, Signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {CardModule} from 'primeng/card';
import {FormatCurrencyPipe} from '@shared/pipes/format-currency.pipe';

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
  templateUrl: './ytd-summary.component.html'
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

  /**
   * Derived signal calculating the net savings (Income - Expenses).
   */
  readonly netSavings: Signal<number> = computed((): number => this.totalIncome() - this.totalExpense());

  /**
   * Derived signal providing semantic Tailwind classes for the savings rate.
   */
  readonly savingsRateStyles = computed(() => {
    const rate: number = this.avgSavingsRate();

    if (rate >= 20) {
      return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20';
    }

    if (rate > 0) {
      return 'text-amber-600 bg-amber-50 dark:bg-amber-950/20';
    }

    return 'text-rose-600 bg-rose-50 dark:bg-rose-950/20';
  });

  protected readonly Math = Math;
}
