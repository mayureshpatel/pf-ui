import {Component, computed, input, InputSignal, Signal} from '@angular/core';
import {CommonModule, formatCurrency} from '@angular/common';
import {CardModule} from 'primeng/card';
import {FormatCurrencyPipe} from '@shared/pipes/format-currency.pipe';

/**
 * A reusable KPI card for the dashboard that displays a metric, its trend,
 * and a comparison to the previous period.
 */
@Component({
  selector: 'app-pulse-card',
  standalone: true,
  imports: [CommonModule, CardModule, FormatCurrencyPipe],
  templateUrl: './pulse-card.component.html'
})
export class PulseCardComponent {
  /** The descriptive title of the metric. */
  readonly title: InputSignal<string> = input.required<string>();

  /** The current value of the metric. */
  readonly value: InputSignal<number> = input.required<number>();

  /** The value from the previous period for comparison. */
  readonly previousValue: InputSignal<number> = input.required<number>();

  /** The display type of the metric. Defaults to 'currency'. */
  readonly type: InputSignal<'currency' | 'percent'> = input<'currency' | 'percent'>('currency');

  /** Whether a positive trend should be considered 'bad' (e.g., for expenses). */
  readonly inverseTrend: InputSignal<boolean> = input<boolean>(false);

  /** Custom text color class for the main value. */
  readonly color: InputSignal<string | null> = input<string | null>(null);

  /**
   * Derived signal that formats the main value based on the type.
   */
  readonly formattedValue: Signal<string> = computed((): string => {
    if (this.type() === 'percent') {
      return `${this.value().toFixed(1)}%`;
    }
    return formatCurrency(this.value(), 'en-US', '$', '1.2-2');
  });

  /**
   * Derived signal calculating the percentage change from the previous period.
   */
  readonly trend: Signal<number> = computed((): number => {
    const prev: number = this.previousValue();
    if (prev === 0) {
      return 0;
    }

    return ((this.value() - prev) / Math.abs(prev)) * 100;
  });

  /**
   * Derived signal providing semantic Tailwind classes for the trend indicator.
   */
  readonly trendStyles = computed(() => {
    const t: number = this.trend();
    if (t === 0) {
      return 'text-surface-500 bg-surface-100 dark:bg-surface-800';
    }

    const isPositive: boolean = t > 0;
    const isGood: boolean = this.inverseTrend() ? !isPositive : isPositive;

    return isGood
      ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 ring-emerald-200/50'
      : 'text-rose-600 bg-rose-50 dark:bg-rose-900/30 ring-rose-200/50';
  });

  /**
   * Derived signal providing the appropriate PrimeIcon for the trend.
   */
  readonly trendIcon: Signal<string> = computed((): string => {
    const t: number = this.trend();
    if (t === 0) {
      return 'pi pi-minus';
    }
    return t > 0 ? 'pi pi-arrow-up' : 'pi pi-arrow-down';
  });

  protected readonly Math = Math;
}
