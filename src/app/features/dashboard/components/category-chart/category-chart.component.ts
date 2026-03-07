import {Component, computed, effect, input, InputSignal, Signal, signal, WritableSignal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {CardModule} from 'primeng/card';
import {ChartModule} from 'primeng/chart';
import {CategoryBreakdown} from '@models/dashboard.model';
import {getCategoryColorHex} from '@shared/utils/category.utils';
import {Category} from '@models/category.model';

@Component({
  selector: 'app-category-chart',
  standalone: true,
  imports: [CommonModule, CardModule, ChartModule],
  templateUrl: './category-chart.component.html'
})
export class CategoryChartComponent {
  title: InputSignal<string> = input<string>('Spending by Category');
  categories: InputSignal<CategoryBreakdown[]> = input.required<CategoryBreakdown[]>();
  topX: InputSignal<number> = input<number>(5);

  chartData: WritableSignal<any> = signal({});
  chartOptions: WritableSignal<any> = signal({});

  hasData: Signal<boolean> = computed((): boolean => this.categories().length > 0);

  constructor() {
    effect((): void => {
      const categories: CategoryBreakdown[] = this.categories();
      if (categories.length > 0) {
        this.updateChartData(categories, this.topX());
      }
    });

    this.initChartOptions();
  }

  /**
   * Constructs the chart data based on the top X categories.
   * <br><br>
   * The data displayed will come from the parent component, which will have selected the period
   * from which the data is pulled from.
   *
   * @param categories The category total data to use for the chart
   * @param topX The number of categories to include in the chart. Defaults to 5.
   */
  private updateChartData(categories: CategoryBreakdown[], topX: number = 5): void {
    const topXCategoryTotals: CategoryBreakdown[] = [...categories]
      .sort((a: CategoryBreakdown, b: CategoryBreakdown): number => b.total - a.total)
      .slice(0, topX);

    const labels: Category[] = topXCategoryTotals.map((c: CategoryBreakdown): Category => c.category || 'Uncategorized');
    const data: number[] = topXCategoryTotals.map((c: CategoryBreakdown): number => Math.abs(c.total));
    const colors: string[] = topXCategoryTotals.map((c: CategoryBreakdown): string => getCategoryColorHex(c.category?.color ?? ''));

    this.chartData.set({
      labels,
      datasets: [
        {
          label: 'Spent',
          data,
          backgroundColor: colors,
          borderRadius: 6,
          barThickness: 24
        }
      ]
    });
  }

  /**
   * Initializes the chart options.
   */
  private initChartOptions(): void {
    const documentStyle: CSSStyleDeclaration = getComputedStyle(document.documentElement);
    const textColor: string = documentStyle.getPropertyValue('--text-color-secondary');

    this.chartOptions.set({
      indexAxis: 'y',
      maintainAspectRatio: false,
      aspectRatio: 0.8,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (context: any): string => {
              const value: any = context.parsed.x || 0;
              return `Spent: $${value.toLocaleString()}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false,
            drawBorder: false
          },
          ticks: {
            color: textColor
          }
        },
        y: {
          grid: {
            display: false,
            drawBorder: false
          },
          ticks: {
            color: textColor
          }
        }
      }
    });
  }
}
