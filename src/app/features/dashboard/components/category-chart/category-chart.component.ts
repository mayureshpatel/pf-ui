import { Component, computed, effect, input, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { CategoryTotal } from '@models/dashboard.model';
import { getCategoryColorHex } from '@shared/utils/category.utils';

@Component({
  selector: 'app-category-chart',
  standalone: true,
  imports: [CommonModule, CardModule, ChartModule],
  templateUrl: './category-chart.component.html'
})
export class CategoryChartComponent {
  title = input<string>('Spending by Category');
  categories = input.required<CategoryTotal[]>();

  chartData: WritableSignal<any> = signal({});
  chartOptions: WritableSignal<any> = signal({});

  hasData = computed(() => this.categories().length > 0);

  constructor() {
    effect(() => {
      const categories = this.categories();
      if (categories.length > 0) {
        this.updateChartData(categories);
      }
    });

    this.initChartOptions();
  }

  private updateChartData(categories: CategoryTotal[]): void {
    // Sort and take top 5
    const top5 = [...categories]
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const labels = top5.map(c => c.categoryName || 'Uncategorized');
    const data = top5.map(c => Math.abs(c.total));
    const colors = top5.map(c => getCategoryColorHex(c.categoryName || 'Uncategorized'));

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

  private initChartOptions(): void {
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue('--text-color-secondary');

    this.chartOptions.set({
      indexAxis: 'y', // Makes it horizontal
      maintainAspectRatio: false,
      aspectRatio: 0.8,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const value = context.parsed.x || 0;
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

  private lightenColor(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = ((num >> 8) & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;

    return '#' + (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    ).toString(16).slice(1);
  }
}
