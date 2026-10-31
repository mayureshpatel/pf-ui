import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  InputSignal,
  Signal,
} from '@angular/core';
import { CardModule } from 'primeng/card';
import { CategoryBreakdown } from '@models/dashboard.model';
import { FormatCurrencyPipe } from '@shared/pipes/format-currency.pipe';
import { getCategoryColor } from '@shared/utils/category.utils';

/** One category's bar in the list: what to print and how wide to draw it. */
export interface CategoryBarRow {
  name: string;
  /** Absolute spend, so expenses stored as negatives read as positive amounts. */
  amount: number;
  color: string;
  /** Bar width as a percentage of the largest shown amount (0 to 100). */
  widthPct: number;
}

/**
 * Component for visualizing spending distribution across categories.
 *
 * Lists the top spending categories for the selected dashboard period as horizontal bars with the
 * amount printed beside each one. Plain HTML rather than a canvas chart, so the amounts are
 * readable without hovering, on touch devices and by assistive technology.
 */
@Component({
  selector: 'app-category-chart',
  standalone: true,
  imports: [CardModule, FormatCurrencyPipe],
  templateUrl: './category-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryChartComponent {
  /** The title of the widget. */
  readonly title: InputSignal<string> = input<string>('Spending by Category');

  /** The list of category spending totals. */
  readonly categories: InputSignal<CategoryBreakdown[]> = input.required<CategoryBreakdown[]>();

  /** The maximum number of categories to display. */
  readonly topX: InputSignal<number> = input<number>(5);

  /** The top categories by absolute spend, largest first, with each bar's relative width. */
  readonly rows: Signal<CategoryBarRow[]> = computed((): CategoryBarRow[] => {
    const topItems: CategoryBreakdown[] = [...this.categories()]
      .sort(
        (a: CategoryBreakdown, b: CategoryBreakdown): number =>
          Math.abs(b.total) - Math.abs(a.total),
      )
      .slice(0, this.topX());
    const largest: number = topItems.length > 0 ? Math.abs(topItems[0].total) : 0;

    return topItems.map((item: CategoryBreakdown): CategoryBarRow => {
      const name: string = item.category?.name || 'Uncategorized';
      const amount: number = Math.abs(item.total);
      return {
        name,
        amount,
        color: item.category?.color || getCategoryColor(item.category?.name || ''),
        widthPct: largest > 0 ? (amount / largest) * 100 : 0,
      };
    });
  });

  /** Derived signal indicating if the chart has data to display. */
  readonly hasData: Signal<boolean> = computed((): boolean => this.categories().length > 0);
}
