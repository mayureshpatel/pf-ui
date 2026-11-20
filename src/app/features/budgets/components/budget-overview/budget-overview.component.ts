import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
  Signal,
} from '@angular/core';
import { SkeletonModule } from 'primeng/skeleton';
import { FormatCurrencyPipe } from '@shared/pipes/format-currency.pipe';
import { BudgetTotals } from '../../utils/budget-helpers';

/** The panel's default mode: how the month is going, and the month-level actions. */
@Component({
  selector: 'app-budget-overview',
  standalone: true,
  imports: [FormatCurrencyPipe, SkeletonModule],
  templateUrl: './budget-overview.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetOverviewComponent {
  readonly totals: InputSignal<BudgetTotals> = input.required<BudgetTotals>();
  readonly monthLabel: InputSignal<string> = input.required<string>();
  readonly canCopy: InputSignal<boolean> = input.required<boolean>();
  /** True while a month is loading, so the figures are never shown under another month's label. */
  readonly loading: InputSignal<boolean> = input<boolean>(false);

  readonly copyLimits: OutputEmitterRef<void> = output<void>();

  /** Width of the spent bar against what is budgeted, 0 to 100. */
  readonly spentWidth: Signal<number> = computed((): number => {
    const { budgeted, spent } = this.totals();
    return budgeted > 0 ? Math.min(Math.round((spent / budgeted) * 1000) / 10, 100) : 0;
  });

  /** The bar in words, for assistive technology. */
  readonly barLabel: Signal<string> = computed((): string => {
    const money = (n: number): string =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
    return `Spent ${money(this.totals().spent)} of ${money(this.totals().budgeted)} budgeted`;
  });
}
