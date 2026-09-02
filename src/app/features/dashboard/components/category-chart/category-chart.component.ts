import {Component, computed, input, InputSignal, Signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {CardModule} from 'primeng/card';
import {ChartModule} from 'primeng/chart';
import {CategoryBreakdown} from '@models/dashboard.model';
import {getCategoryColor} from '@shared/utils/category.utils';

/**
 * Component for visualizing spending distribution across categories.
 *
 * Uses a horizontal bar chart to display the top spending categories
 * for the selected dashboard period.
 */
@Component({
  selector: 'app-category-chart',
  standalone: true,
  imports: [CommonModule, CardModule, ChartModule],
  templateUrl: './category-chart.component.html'
})
export class CategoryChartComponent {
  /** The title of the chart widget. */
  readonly title: InputSignal<string> = input<string>('Spending by Category');

  /** The list of category spending totals. */
  readonly categories: InputSignal<CategoryBreakdown[]> = input.required<CategoryBreakdown[]>();

  /** The maximum number of categories to display in the chart. */
  readonly topX: InputSignal<number> = input<number>(5);

  /** The reactive chart data configuration. */
  readonly chartData: Signal<any> = computed(() => {
    const topItems: CategoryBreakdown[] = [...this.categories()]
      .sort((a: CategoryBreakdown, b: CategoryBreakdown): number => Math.abs(b.total) - Math.abs(a.total))
      .slice(0, this.topX());

    return {
      labels: topItems.map((item: CategoryBreakdown): string => item.category?.name || 'Uncategorized'),
      datasets: [
        {
          label: 'Total Spent',
          data: topItems.map((item: CategoryBreakdown): number => Math.abs(item.total)),
          backgroundColor: topItems.map((item: CategoryBreakdown): string => item.category?.color || getCategoryColor(item.category?.name || '')),
          borderRadius: 8,
          barThickness: 32,
          hoverBackgroundColor: topItems.map((item: CategoryBreakdown): string => item.category?.color || getCategoryColor(item.category?.name || ''))
        }
      ]
    };
  });

  /** Derived signal indicating if the chart has data to display. */
  readonly hasData: Signal<boolean> = computed((): boolean => this.categories().length > 0);

  /**
   * Static visual configuration for the horizontal bar chart. Never changes after
   * construction, so this is a plain property rather than a signal.
   */
  readonly chartOptions = {
    indexAxis: 'y',
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: '#1e293b',
        padding: 12,
        titleFont: {size: 14, weight: 'bold'},
        bodyFont: {size: 13, family: 'monospace'},
        usePointStyle: true,
        callbacks: {
          label: (context: any): string => {
            const value: any = context.parsed.x || 0;
            return ` Total Spent: $${value.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
          }
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: {
          color: 'rgba(148, 163, 184, 0.1)',
          drawBorder: false
        },
        ticks: {
          color: '#94a3b8',
          font: {size: 11, family: 'monospace'},
          callback: (value: number): string => `$${value >= 1000 ? (value / 1000) + 'k' : value}`
        }
      },
      y: {
        grid: {
          display: false,
          drawBorder: false
        },
        ticks: {
          color: '#64748b',
          font: {size: 12, weight: '700'}
        }
      }
    }
  };
}
