import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  InputSignal,
  Signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Params, RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { CategoryBreakdown } from '@models/dashboard.model';
import { FormatCurrencyPipe } from '@shared/pipes/format-currency.pipe';
import { CategoryType } from '@models/category.model';
import { getCategoryColor } from '@shared/utils/category.utils';

/** One category's bar in the list: what to print and how wide to draw it. */
export interface CategoryBarRow {
  name: string;
  /** The value the Transactions page filters this category by ('null' is its Uncategorized filter). */
  filterName: string;
  /** Absolute spend, so expenses stored as negatives read as positive amounts. */
  amount: number;
  color: string;
  /** True for spending with no category yet, which the owner can sort out from here. */
  uncategorized: boolean;
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
  imports: [CardModule, NgTemplateOutlet, RouterLink, FormatCurrencyPipe],
  templateUrl: './category-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryChartComponent {
  /** The title of the widget. */
  readonly title: InputSignal<string> = input<string>('Spending by Category');

  /** The list of category spending totals. */
  readonly categories: InputSignal<CategoryBreakdown[]> = input.required<CategoryBreakdown[]>();

  /**
   * The Transactions query for the selected period and spending type. When set, each row links to
   * that category's transactions; when null the rows are plain.
   */
  readonly link: InputSignal<Params | null> = input<Params | null>(null);

  /** The maximum number of categories to display. */
  readonly topX: InputSignal<number> = input<number>(5);

  /** True when a category moves money between the owner's own accounts rather than spending it. */
  private static isTransfer(item: CategoryBreakdown): boolean {
    return item.category?.type === CategoryType.TRANSFER;
  }

  /** Spending in transfer-type categories: money moved between accounts, which is not ranked. */
  readonly transferTotal: Signal<number> = computed((): number =>
    this.categories()
      .filter(CategoryChartComponent.isTransfer)
      .reduce((sum: number, item: CategoryBreakdown): number => sum + Math.abs(item.total), 0),
  );

  /** The top categories by absolute spend, largest first, with each bar's relative width. */
  readonly rows: Signal<CategoryBarRow[]> = computed((): CategoryBarRow[] => {
    const topItems: CategoryBreakdown[] = this.categories()
      .filter((item: CategoryBreakdown): boolean => !CategoryChartComponent.isTransfer(item))
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
        filterName: item.category?.name || 'null',
        amount,
        uncategorized: !item.category,
        color: item.category?.color || getCategoryColor(item.category?.name || ''),
        widthPct: largest > 0 ? (amount / largest) * 100 : 0,
      };
    });
  });

  /**
   * The Transactions query for one row, or null when the chart has no link.
   *
   * @param row - The row being linked.
   */
  linkFor(row: CategoryBarRow): Params | null {
    const base: Params | null = this.link();
    return base ? { ...base, categoryName: row.filterName } : null;
  }

  /** Derived signal indicating if the chart has data to display. */
  readonly hasData: Signal<boolean> = computed((): boolean => this.rows().length > 0);
}
