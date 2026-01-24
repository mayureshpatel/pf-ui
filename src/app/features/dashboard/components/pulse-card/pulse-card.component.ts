import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { formatCurrency } from '@shared/utils/account.utils';

@Component({
  selector: 'app-pulse-card',
  standalone: true,
  imports: [CommonModule, CardModule],
  templateUrl: './pulse-card.component.html'
})
export class PulseCardComponent {
  title = input.required<string>();
  value = input.required<number>();
  previousValue = input.required<number>();
  type = input<'currency' | 'percent'>('currency');
  inverseTrend = input<boolean>(false); // If true, decrease is good (e.g. Expenses)

  formattedValue = computed(() => {
    if (this.type() === 'percent') {
      return `${this.value().toFixed(1)}%`;
    }
    return formatCurrency(this.value());
  });

  trend = computed(() => {
    if (this.previousValue() === 0) return 0;
    return ((this.value() - this.previousValue()) / Math.abs(this.previousValue())) * 100;
  });

  trendLabel = computed(() => {
    const t = this.trend();
    if (t === 0) return 'No change';
    return `${Math.abs(t).toFixed(1)}% ${t > 0 ? 'increase' : 'decrease'}`;
  });

  trendClass = computed(() => {
    const t = this.trend();
    if (t === 0) return 'text-muted-color';
    
    const isPositive = t > 0;
    const isGood = this.inverseTrend() ? !isPositive : isPositive;
    
    return isGood ? 'text-green-500' : 'text-red-500';
  });

  trendIcon = computed(() => {
    const t = this.trend();
    if (t === 0) return 'pi pi-minus';
    return t > 0 ? 'pi pi-arrow-up' : 'pi pi-arrow-down';
  });

  protected readonly Math = Math;
  protected readonly formatCurrency = formatCurrency;
}
