import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  InputSignal,
  Signal,
} from '@angular/core';
import { CommonModule, formatCurrency } from '@angular/common';
import { Params, RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';

/**
 * A reusable KPI card for the dashboard that displays a metric, its trend,
 * and a comparison to the previous period.
 */
@Component({
  selector: 'app-pulse-card',
  standalone: true,
  imports: [CommonModule, CardModule, RouterLink],
  templateUrl: './pulse-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
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

  /** Query params for the Transactions page that list what is behind this number; no link when null. */
  readonly link: InputSignal<Params | null> = input<Params | null>(null);

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

  /** A change under this many percent is too small to call a move. */
  private static readonly FLAT_BELOW = 0.05;

  /** Whether the change is too small to show as anything but "no change". */
  readonly isFlat: Signal<boolean> = computed(
    (): boolean => Math.abs(this.trend()) < PulseCardComponent.FLAT_BELOW,
  );

  /**
   * The size of the change as printed: a whole percent from 1% up, one decimal below it, so a
   * +0.2% change does not read as "0%".
   */
  readonly trendLabel: Signal<string> = computed((): string => {
    const size: number = Math.abs(this.trend());
    return size < 1 ? size.toFixed(1) : size.toFixed(0);
  });

  /** Whether the previous period has a non-zero value to compare against. */
  readonly hasComparison: Signal<boolean> = computed((): boolean => this.previousValue() !== 0);

  /** The previous value formatted for the comparison line. */
  readonly previousLabel: Signal<string> = computed((): string => {
    if (this.type() === 'percent') {
      return `${this.previousValue().toFixed(1)}%`;
    }
    return formatCurrency(this.previousValue(), 'en-US', '$', '1.2-2');
  });

  /**
   * Derived signal providing semantic text color classes for the trend indicator. Uses the 700
   * shade on light surfaces (400 in dark) for AA contrast at small sizes.
   */
  readonly trendStyles = computed(() => {
    const t: number = this.trend();
    if (this.isFlat()) {
      return 'text-muted-color';
    }

    const isPositive: boolean = t > 0;
    const isGood: boolean = this.inverseTrend() ? !isPositive : isPositive;

    return isGood ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400';
  });

  /**
   * Derived signal providing the appropriate PrimeIcon for the trend.
   */
  readonly trendIcon: Signal<string> = computed((): string => {
    const t: number = this.trend();
    if (this.isFlat()) {
      return 'pi pi-minus';
    }
    return t > 0 ? 'pi pi-arrow-up' : 'pi pi-arrow-down';
  });

  protected readonly Math = Math;
}
