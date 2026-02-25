import {Component, computed, input, InputSignal, Signal} from '@angular/core';
import {CommonModule, formatCurrency} from '@angular/common';
import {CardModule} from 'primeng/card';
import {FormatCurrencyPipe} from '@shared/pipes/format-currency.pipe';

@Component({
  selector: 'app-pulse-card',
  standalone: true,
  imports: [CommonModule, CardModule, FormatCurrencyPipe],
  templateUrl: './pulse-card.component.html'
})
export class PulseCardComponent {
  protected readonly Math = Math;

  title: InputSignal<string> = input.required<string>();
  value: InputSignal<number> = input.required<number>();
  previousValue: InputSignal<number> = input.required<number>();

  type: InputSignal<'currency' | 'percent'> = input<'currency' | 'percent'>('currency');
  inverseTrend: InputSignal<boolean> = input<boolean>(false);
  color: InputSignal<string | null> = input<string | null>(null);

  formattedValue: Signal<string> = computed((): string => {
    if (this.type() === 'percent') {
      return `${this.value().toFixed(1)}%`;
    }
    return formatCurrency(this.value(), 'en-US', '$', '1.2-2');
  });

  trend: Signal<number> = computed((): number => {
    if (this.previousValue() === 0) return 0;
    return ((this.value() - this.previousValue()) / Math.abs(this.previousValue())) * 100;
  });

  // todo: what is this?
  trendLabel: Signal<string> = computed((): string => {
    const trendPercentage: number = this.trend();
    if (trendPercentage === 0) {
      return 'No change';
    }
    return `${Math.abs(trendPercentage).toFixed(1)}% ${trendPercentage > 0 ? 'increase' : 'decrease'}`;
  });

  trendClass = computed(() => {
    const trendPercentage: number = this.trend();
    if (trendPercentage === 0) {
      return 'text-muted-color';
    }

    const isPositive: boolean = trendPercentage > 0;
    const isGood: boolean = this.inverseTrend() ? !isPositive : isPositive;

    return isGood ? 'text-green-500' : 'text-red-500';
  });

  trendIcon = computed(() => {
    const trendPercentage: number = this.trend();
    if (trendPercentage === 0) {
      return 'pi pi-minus';
    }
    return trendPercentage > 0 ? 'pi pi-arrow-up' : 'pi pi-arrow-down';
  });
}
