import { Component, computed, effect, input, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { UIChart } from 'primeng/chart';
import { CategoryTotal } from '@models/dashboard.model';
import { getCategoryColorHex } from '@shared/utils/category.utils';

@Component({
  selector: 'app-category-chart',
  standalone: true,
  imports: [CommonModule, CardModule, UIChart],
  templateUrl: './category-chart.component.html'
})
export class CategoryChartComponent {
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
    const labels = categories.map(c => c.categoryName || 'Uncategorized');
    const data = categories.map(c => Math.abs(c.total));

    // Use consistent colors based on category names
    const colors = categories.map(c => getCategoryColorHex(c.categoryName || 'Uncategorized'));

    this.chartData.set({
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
          hoverBackgroundColor: colors.map(c => this.lightenColor(c, 10))
        }
      ]
    });
  }

  private initChartOptions(): void {
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue('--text-color');

    this.chartOptions.set({
      plugins: {
        legend: {
          labels: {
            usePointStyle: true,
            color: textColor
          },
          position: 'bottom'
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${label}: $${value.toLocaleString()} (${percentage}%)`;
            }
          }
        }
      }
    });
  }

  private generateColors(count: number): string[] {
    const baseColors = [
      '#3B82F6', // blue
      '#10B981', // green
      '#F59E0B', // amber
      '#EF4444', // red
      '#8B5CF6', // purple
      '#EC4899', // pink
      '#06B6D4', // cyan
      '#F97316', // orange
      '#14B8A6', // teal
      '#6366F1'  // indigo
    ];

    if (count <= baseColors.length) {
      return baseColors.slice(0, count);
    }

    // If more categories than colors, repeat with variations
    const colors: string[] = [];
    for (let i = 0; i < count; i++) {
      const baseColor = baseColors[i % baseColors.length];
      const variation = Math.floor(i / baseColors.length) * 15;
      colors.push(this.lightenColor(baseColor, variation));
    }
    return colors;
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
